import crypto from 'crypto';
import { PrismaClient } from '@prisma/client';
import type { Draft as DraftRow, Quote as QuoteRow, QuoteDraftRevision as RevisionRow, PricingItem as PricingRow } from '@prisma/client';
import {
  DraftPayload,
  DraftStatus,
  OrderEntity,
  PricingItem,
  QuoteCalculationResult,
  QuoteDocument,
  QuoteDraft,
  QuoteDraftSummary,
  QuotePublishMeta,
} from '../src/types.js';
import { DEFAULT_PRICING_CATALOG } from './defaultCatalog.js';

const prisma = new PrismaClient();

/** 초안 1건이 보관하는 최대 변경 이력 수 */
const MAX_DRAFT_HISTORY = 20;
/** 이 기간 동안 수정이 없으면 보관(ARCHIVED) 처리 */
const ARCHIVE_AFTER_DAYS = 30;
/** 보관 상태로 이 기간이 더 지나면 영구 삭제 */
const PURGE_AFTER_DAYS = 90;

/**
 * 초안 저장 결과.
 * 판별자를 문자열로 둔 이유: 이 프로젝트는 strictNullChecks 를 켜지 않아
 * boolean 리터럴 판별자로는 타입이 좁혀지지 않는다.
 */
export type DraftSaveResult =
  | { status: 'OK'; draft: QuoteDraft }
  | { status: 'NOT_FOUND' }
  | { status: 'CONFLICT'; current: QuoteDraft };

const daysBetween = (from: Date, to: number) => (to - from.getTime()) / 86_400_000;

// ---------------------------------------------------------------------------
// Prisma row → 도메인 타입 매핑
// (저장 형식(테이블·컬럼)과 API가 주고받는 모양을 분리해두면, 나중에 스키마를
//  바꿔도 서버 라우트는 손댈 필요가 없다.)
// ---------------------------------------------------------------------------

function toPricingItem(row: PricingRow): PricingItem {
  return {
    id: row.id,
    code: row.code,
    category: row.category as PricingItem['category'],
    name: row.name,
    spec: row.spec,
    material: row.material,
    unit: row.unit,
    costPrice: row.costPrice,
    sellingPrice: row.sellingPrice,
    supplier: row.supplier,
    stockStatus: row.stockStatus as PricingItem['stockStatus'],
    notes: row.notes ?? undefined,
    updatedAt: row.updatedAt.toISOString(),
  };
}

function toQuoteDocument(row: QuoteRow): QuoteDocument {
  return {
    id: row.id,
    quoteNumber: row.quoteNumber,
    title: row.title,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    status: row.status as QuoteDocument['status'],
    targetMarginRate: row.targetMarginRate,
    version: row.version,
    parentQuoteId: row.parentQuoteId ?? undefined,
    publishMeta: (row.publishMeta as unknown as QuotePublishMeta | null) ?? undefined,
    orderEntity: row.orderEntity as unknown as OrderEntity,
    calculationResult: row.calculationResult as unknown as QuoteCalculationResult,
    appliedPricingSnapshot: (row.appliedPricingSnapshot as unknown as PricingItem[] | null) ?? undefined,
    notes: row.notes ?? undefined,
    companyInfo: row.companyInfo as unknown as QuoteDocument['companyInfo'],
  };
}

function toDraft(row: DraftRow & { revisions: RevisionRow[] }): QuoteDraft {
  return {
    id: row.id,
    revision: row.revision,
    status: row.status as DraftStatus,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    lastEditorId: row.lastEditorId ?? '',
    payload: row.payload as unknown as DraftPayload,
    history: [...row.revisions]
      .sort((a, b) => a.revision - b.revision)
      .map((r) => ({
        revision: r.revision,
        savedAt: r.savedAt.toISOString(),
        label: r.label,
        payload: r.payload as unknown as DraftPayload,
      })),
    pricingFingerprint: row.pricingFingerprint,
    publishedQuoteIds: (row.publishedQuoteIds as unknown as string[]) ?? [],
  };
}

function toDraftSummary(row: DraftRow): QuoteDraftSummary {
  const payload = row.payload as unknown as DraftPayload;
  return {
    id: row.id,
    revision: row.revision,
    status: row.status as DraftStatus,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    step: row.step as QuoteDraftSummary['step'],
    customerName: row.customerName,
    projectName: row.projectName,
    quoteTitle: payload?.quoteTitle ?? '',
    itemCount: payload?.reviewItems?.length ?? 0,
    totalAmount: row.totalAmount ?? null,
    publishedQuoteIds: (row.publishedQuoteIds as unknown as string[]) ?? [],
  };
}

/**
 * 견적서 목록 조회 시 원문 대조에 쓰는 대소문자 무시 부분일치.
 * SQLite LIKE 는 ASCII 문자에 한해 기본적으로 대소문자를 구분하지 않는다
 * (한글은 대소문자 구분이 없으므로 영향받지 않는다).
 */
const contains = (value: string) => ({ contains: value });

class PrismaStore {
  constructor() {
    // 서버 기동 시 1회, 오래된 초안 보관·폐기 정책을 실행한다.
    this.runDraftRetention().catch((err) => console.error('초안 보관 정책 실행 실패:', err));
    this.initCatalogIfNeeded().catch((err) => console.error('단가표 초기화 실패:', err));
  }

  private async initCatalogIfNeeded() {
    try {
      const count = await prisma.pricingItem.count();
      if (count === 0) {
        console.log('단가표가 비어 있어 기본 카탈로그를 초기화합니다...');
        await this.resetPricingCatalog();
        console.log('기본 단가 카탈로그 초기화 완료.');
      }
    } catch (err) {
      console.error('기본 단가 카탈로그 초기화 중 오류:', err);
    }
  }

  // ---------------------------------------------------------------------
  // PRICING CRUD
  // ---------------------------------------------------------------------
  public async getPricingItems(search?: string, category?: string): Promise<PricingItem[]> {
    const where: Record<string, unknown> = {};
    if (category && category !== 'ALL') where.category = category;
    if (search && search.trim()) {
      const q = search.trim();
      where.OR = [
        { name: contains(q) },
        { code: contains(q) },
        { material: contains(q) },
        { spec: contains(q) },
        { supplier: contains(q) },
      ];
    }
    const rows = await prisma.pricingItem.findMany({ where, orderBy: { updatedAt: 'desc' } });
    return rows.map(toPricingItem);
  }

  public async getPricingItemById(id: string): Promise<PricingItem | undefined> {
    const row = await prisma.pricingItem.findUnique({ where: { id } });
    return row ? toPricingItem(row) : undefined;
  }

  public async getPricingItemByCode(code: string): Promise<PricingItem | undefined> {
    const row = await prisma.pricingItem.findFirst({ where: { code: { equals: code } } });
    return row ? toPricingItem(row) : undefined;
  }

  public async addPricingItem(item: Omit<PricingItem, 'id' | 'updatedAt'>): Promise<PricingItem> {
    const row = await prisma.pricingItem.create({ data: item });
    return toPricingItem(row);
  }

  public async updatePricingItem(id: string, updates: Partial<PricingItem>): Promise<PricingItem | null> {
    try {
      const { id: _ignoreId, updatedAt: _ignoreUpdatedAt, ...data } = updates;
      const row = await prisma.pricingItem.update({ where: { id }, data });
      return toPricingItem(row);
    } catch {
      return null; // 존재하지 않는 id — Prisma P2025
    }
  }

  public async deletePricingItem(id: string): Promise<boolean> {
    try {
      await prisma.pricingItem.delete({ where: { id } });
      return true;
    } catch {
      return false;
    }
  }

  public async bulkUpsertPricingItems(
    items: Array<Omit<PricingItem, 'id' | 'updatedAt'>>
  ): Promise<{ added: number; updated: number }> {
    let added = 0;
    let updated = 0;

    for (const item of items) {
      const existing = await prisma.pricingItem.findFirst({
        where: { OR: [{ code: item.code }, { name: item.name }] },
      });
      if (existing) {
        await prisma.pricingItem.update({ where: { id: existing.id }, data: item });
        updated++;
      } else {
        await prisma.pricingItem.create({ data: item });
        added++;
      }
    }
    return { added, updated };
  }

  public async resetPricingCatalog(): Promise<PricingItem[]> {
    await prisma.pricingItem.deleteMany({});
    await prisma.pricingItem.createMany({
      data: DEFAULT_PRICING_CATALOG.map(({ id, updatedAt, ...rest }) => rest),
    });
    return this.getPricingItems();
  }

  // ---------------------------------------------------------------------
  // QUOTES CRUD & AUDIT
  // ---------------------------------------------------------------------
  public async getQuotes(status?: string, search?: string): Promise<QuoteDocument[]> {
    const where: Record<string, unknown> = {};
    if (status && status !== 'ALL') where.status = status;
    if (search && search.trim()) {
      const s = search.trim();
      where.OR = [{ quoteNumber: contains(s) }, { title: contains(s) }];
      // orderEntity 는 Json 컬럼이라 SQLite에서 텍스트 검색이 불가능하므로
      // 고객명·주소·연락처는 조회 후 애플리케이션 레벨에서 한 번 더 거른다.
    }
    const rows = await prisma.quote.findMany({ where, orderBy: { createdAt: 'desc' } });
    let quotes = rows.map(toQuoteDocument);
    if (search && search.trim()) {
      const s = search.trim().toLowerCase();
      quotes = quotes.filter(
        (q) =>
          q.quoteNumber.toLowerCase().includes(s) ||
          q.title.toLowerCase().includes(s) ||
          q.orderEntity.customerName.toLowerCase().includes(s) ||
          q.orderEntity.address.toLowerCase().includes(s) ||
          q.orderEntity.contact.includes(s)
      );
    }
    return quotes;
  }

  public async getQuoteById(id: string): Promise<QuoteDocument | undefined> {
    const row =
      (await prisma.quote.findUnique({ where: { id } })) ??
      (await prisma.quote.findUnique({ where: { quoteNumber: id } }));
    return row ? toQuoteDocument(row) : undefined;
  }

  public async saveQuote(
    quote: Omit<QuoteDocument, 'id' | 'createdAt' | 'updatedAt' | 'quoteNumber'> & { quoteNumber?: string }
  ): Promise<QuoteDocument> {
    const todayStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const todayPrefix = new Date().toISOString().slice(0, 10);
    const todaysCount = await prisma.quote.count({ where: { createdAt: { gte: new Date(`${todayPrefix}T00:00:00.000Z`) } } });
    const generatedNumber = quote.quoteNumber || `QN-${todayStr}-${String(todaysCount + 1).padStart(3, '0')}`;

    const row = await prisma.quote.create({
      data: {
        quoteNumber: generatedNumber,
        title: quote.title,
        status: quote.status,
        targetMarginRate: quote.targetMarginRate,
        version: quote.version ?? 1,
        parentQuoteId: quote.parentQuoteId ?? null,
        publishMeta: (quote.publishMeta ?? undefined) as any,
        orderEntity: quote.orderEntity as any,
        calculationResult: quote.calculationResult as any,
        appliedPricingSnapshot: (quote.appliedPricingSnapshot ?? undefined) as any,
        notes: quote.notes ?? '',
        companyInfo: quote.companyInfo as any,
      },
    });
    return toQuoteDocument(row);
  }

  public async updateQuote(id: string, updates: Partial<QuoteDocument>): Promise<QuoteDocument | null> {
    try {
      const { id: _ignoreId, createdAt: _c, updatedAt: _u, ...rest } = updates as any;
      const row = await prisma.quote.update({ where: { id }, data: rest });
      return toQuoteDocument(row);
    } catch {
      return null;
    }
  }

  public async deleteQuote(id: string): Promise<boolean> {
    try {
      await prisma.quote.delete({ where: { id } });
      return true;
    } catch {
      return false;
    }
  }

  // ---------------------------------------------------------------------
  // 견적 초안 (DRAFTS)
  // ---------------------------------------------------------------------

  /**
   * 단가표의 지문(fingerprint).
   * 가격·단위에 영향을 주는 필드만 해싱하므로, 메모 수정 등으로는 값이 바뀌지 않는다.
   * 초안에 기록해 두었다가 나중에 비교해 "단가가 바뀌었으니 다시 계산" 안내에 사용한다.
   */
  public async getPricingFingerprint(): Promise<string> {
    const rows = await prisma.pricingItem.findMany({
      select: { id: true, code: true, costPrice: true, sellingPrice: true, unit: true },
    });
    const material = rows
      .map((i) => `${i.id}:${i.code}:${i.costPrice}:${i.sellingPrice}:${i.unit}`)
      .sort()
      .join('|');
    return crypto.createHash('sha1').update(material).digest('hex').slice(0, 16);
  }

  public async createDraft(payload: DraftPayload, editorId: string): Promise<QuoteDraft> {
    const fingerprint = await this.getPricingFingerprint();
    const row = await prisma.draft.create({
      data: {
        status: 'ACTIVE',
        revision: 1,
        payload: payload as any,
        customerName: payload.orderEntity?.customerName ?? '',
        projectName: payload.orderEntity?.projectName ?? '',
        step: payload.step ?? 1,
        totalAmount: payload.calculationResult?.summary?.finalGrandTotal ?? null,
        lastEditorId: editorId,
        pricingFingerprint: fingerprint,
        publishedQuoteIds: [] as any,
        revisions: { create: [{ revision: 1, label: '초안 생성', payload: payload as any }] },
      },
      include: { revisions: true },
    });
    return toDraft(row);
  }

  public async getDrafts(status?: DraftStatus | 'ALL'): Promise<QuoteDraftSummary[]> {
    const where: Record<string, unknown> = {};
    if (status && status !== 'ALL') where.status = status;
    const rows = await prisma.draft.findMany({ where, orderBy: { updatedAt: 'desc' } });
    return rows.map(toDraftSummary);
  }

  public async getDraftById(id: string): Promise<QuoteDraft | undefined> {
    const row = await prisma.draft.findUnique({ where: { id }, include: { revisions: true } });
    return row ? toDraft(row) : undefined;
  }

  /**
   * 초안 저장. 낙관적 잠금:
   * 클라이언트가 보낸 revision 이 서버 최신본과 다르면 덮어쓰지 않고 CONFLICT 를 돌려준다.
   * (같은 초안을 여러 창에서 열어 둔 경우를 감지하기 위함)
   */
  public async saveDraft(
    id: string,
    args: { revision: number; payload: DraftPayload; label?: string; editorId: string }
  ): Promise<DraftSaveResult> {
    const current = await prisma.draft.findUnique({ where: { id }, include: { revisions: true } });
    if (!current) return { status: 'NOT_FOUND' };
    if (args.revision !== current.revision) {
      return { status: 'CONFLICT', current: toDraft(current) };
    }

    const nextRevision = current.revision + 1;
    // 계산 결과가 갱신된 저장이라면 단가 지문도 함께 갱신한다.
    const calcChanged =
      args.payload.calculationResult &&
      args.payload.calculationResult.calculatedAt !==
        (current.payload as unknown as DraftPayload)?.calculationResult?.calculatedAt;
    const pricingFingerprint = calcChanged ? await this.getPricingFingerprint() : current.pricingFingerprint;

    // 이력이 MAX_DRAFT_HISTORY 를 넘으면 가장 오래된 것부터 정리한다.
    const overflow = current.revisions.length + 1 - MAX_DRAFT_HISTORY;
    if (overflow > 0) {
      const oldestIds = [...current.revisions]
        .sort((a, b) => a.revision - b.revision)
        .slice(0, overflow)
        .map((r) => r.id);
      await prisma.quoteDraftRevision.deleteMany({ where: { id: { in: oldestIds } } });
    }

    const row = await prisma.draft.update({
      where: { id },
      data: {
        revision: nextRevision,
        payload: args.payload as any,
        customerName: args.payload.orderEntity?.customerName ?? '',
        projectName: args.payload.orderEntity?.projectName ?? '',
        step: args.payload.step ?? 1,
        totalAmount: args.payload.calculationResult?.summary?.finalGrandTotal ?? null,
        lastEditorId: args.editorId,
        pricingFingerprint,
        revisions: {
          create: [{ revision: nextRevision, label: args.label || '자동 저장', payload: args.payload as any }],
        },
      },
      include: { revisions: true },
    });
    return { status: 'OK', draft: toDraft(row) };
  }

  /** 과거 저장 시점으로 되돌린다 (복구 자체도 새 revision 으로 기록). */
  public async restoreDraftRevision(id: string, revision: number, editorId: string): Promise<QuoteDraft | null> {
    const current = await prisma.draft.findUnique({ where: { id }, include: { revisions: true } });
    if (!current) return null;

    const target = current.revisions.find((r) => r.revision === revision);
    if (!target) return null;

    const targetPayload = target.payload as unknown as DraftPayload;
    const nextRevision = current.revision + 1;

    const row = await prisma.draft.update({
      where: { id },
      data: {
        revision: nextRevision,
        status: current.status === 'ARCHIVED' ? 'ACTIVE' : current.status,
        payload: target.payload as any,
        customerName: targetPayload.orderEntity?.customerName ?? '',
        projectName: targetPayload.orderEntity?.projectName ?? '',
        step: targetPayload.step ?? 1,
        totalAmount: targetPayload.calculationResult?.summary?.finalGrandTotal ?? null,
        lastEditorId: editorId,
        revisions: {
          create: [{ revision: nextRevision, label: `rev.${revision} 상태로 복구`, payload: target.payload as any }],
        },
      },
      include: { revisions: true },
    });
    return toDraft(row);
  }

  public async deleteDraft(id: string): Promise<boolean> {
    try {
      await prisma.draft.delete({ where: { id } });
      return true;
    } catch {
      return false;
    }
  }

  /** 견적서가 발행되면 초안을 PUBLISHED 로 전환하고 발행 문서 id 를 연결한다. */
  public async markDraftPublished(id: string, quoteId: string): Promise<QuoteDraft | null> {
    const current = await prisma.draft.findUnique({ where: { id } });
    if (!current) return null;

    const publishedQuoteIds = [...((current.publishedQuoteIds as unknown as string[]) ?? []), quoteId];
    const row = await prisma.draft.update({
      where: { id },
      data: { status: 'PUBLISHED', publishedQuoteIds: publishedQuoteIds as any },
      include: { revisions: true },
    });
    return toDraft(row);
  }

  /**
   * 보관·폐기 정책.
   * ACTIVE 인데 30일 이상 수정이 없으면 ARCHIVED 로, ARCHIVED 상태로 90일이 더 지나면 삭제한다.
   * 발행 완료(PUBLISHED)된 초안은 이력 가치가 있으므로 보관만 하고 삭제하지 않는다.
   */
  public async runDraftRetention(): Promise<{ archived: number; purged: number }> {
    const now = Date.now();

    const staleActive = await prisma.draft.findMany({ where: { status: 'ACTIVE' }, select: { id: true, updatedAt: true } });
    const toArchive = staleActive.filter((d) => daysBetween(d.updatedAt, now) > ARCHIVE_AFTER_DAYS).map((d) => d.id);
    let archived = 0;
    if (toArchive.length > 0) {
      const result = await prisma.draft.updateMany({ where: { id: { in: toArchive } }, data: { status: 'ARCHIVED' } });
      archived = result.count;
    }

    const archivedDrafts = await prisma.draft.findMany({
      where: { status: 'ARCHIVED' },
      select: { id: true, updatedAt: true, publishedQuoteIds: true },
    });
    const toPurge = archivedDrafts
      .filter((d) => {
        const published = ((d.publishedQuoteIds as unknown as string[]) ?? []).length > 0;
        if (published) return false;
        return daysBetween(d.updatedAt, now) > PURGE_AFTER_DAYS;
      })
      .map((d) => d.id);
    let purged = 0;
    if (toPurge.length > 0) {
      const result = await prisma.draft.deleteMany({ where: { id: { in: toPurge } } });
      purged = result.count;
    }

    if (archived > 0 || purged > 0) {
      console.log(`[초안 정리] 보관 전환 ${archived}건, 영구 삭제 ${purged}건`);
    }
    return { archived, purged };
  }
}

export const db = new PrismaStore();
