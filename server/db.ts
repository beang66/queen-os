// PrismaClient 가 만들어지기 전에 .env 가 로드되어야 한다. 이 import 는 순서가 곧 기능이므로
// 항상 첫 줄에 둔다 (자세한 이유는 server/env.ts 주석 참고).
import { assertDatabaseEnv } from './env.js';
import crypto from 'crypto';
import { PrismaClient } from '@prisma/client';

// DB 설정이 없으면 여기서 멈춘다. 그대로 두면 서버는 정상 기동한 것처럼 보이다가
// 사용자가 초안을 저장하는 순간 Prisma 스택 트레이스로 실패한다 (포트 충돌 처리와 같은 방식).
try {
  assertDatabaseEnv();
} catch (err: any) {
  console.error(err.message);
  if (!process.env.VERCEL) {
    process.exit(1);
  }
}
import type {
  Draft as DraftRow,
  Quote as QuoteRow,
  QuoteDraftRevision as RevisionRow,
  PricingItem as PricingRow,
  User as UserRow,
} from '@prisma/client';
import {
  AiParseLogSummary,
  AppUser,
  AuthUser,
  DraftPayload,
  DraftStatus,
  OrderEntity,
  ParseEngine,
  ParseLogKind,
  PricingItem,
  QuoteCalculationResult,
  QuoteDocument,
  QuoteDraft,
  QuoteDraftSummary,
  QuotePublishMeta,
  UserRole,
  UserStatus,
} from '../src/types.js';
import { DEFAULT_PRICING_CATALOG } from './defaultCatalog.js';
import {
  FieldDiff,
  ParseAccuracyStats,
  ParseDiffResult,
  diffOrderEntity,
  summarizeParseLogs,
} from './parseAccuracy.js';
import type { ParseTelemetry } from './geminiService.js';
import { generateInitialPassword, hashPassword, verifyPassword } from './auth.js';

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

/**
 * Prisma 오류를 화면에 그대로 띄울 수 있는 한 문장으로 바꾼다.
 *
 * 라우트가 err.message 를 그대로 내려주면 사용자는 "Invalid
 * prisma.pricingItem.findMany() invocation ... schema.prisma:8" 같은 스택을 보게 되고,
 * 정작 무엇을 해야 하는지는 알 수 없습니다. 알아볼 수 있는 유형만 골라 바꾸고,
 * 나머지는 원문을 유지합니다.
 */
export function describeDbError(err: any): string {
  const message = String(err?.message ?? err ?? '');
  const code = err?.code;

  if (message.includes('Environment variable not found: DATABASE_URL')) {
    return '데이터베이스 접속 정보(DATABASE_URL)를 찾을 수 없습니다. 프로젝트 루트의 .env 를 확인한 뒤 서버를 다시 시작하세요.';
  }
  if (code === 'P1001' || message.includes("Can't reach database server")) {
    return '데이터베이스 서버에 연결할 수 없습니다. 네트워크 연결과 Supabase 접속 정보를 확인하세요.';
  }
  if (code === 'P1002' || message.includes('timed out')) {
    return '데이터베이스 응답이 지연되어 요청이 취소되었습니다. 잠시 후 다시 시도하세요.';
  }
  if (code === 'P2021' || message.includes('does not exist in the current database')) {
    return '데이터베이스에 필요한 테이블이 없습니다. `npx prisma db push` 로 스키마를 반영하세요.';
  }
  return message;
}

// ---------------------------------------------------------------------------
// Prisma row → 도메인 타입 매핑
// (저장 형식(테이블·컬럼)과 API가 주고받는 모양을 분리해두면, 나중에 스키마를
//  바꿔도 서버 라우트는 손댈 필요가 없다.)
// ---------------------------------------------------------------------------

/**
 * 계정이 없을 때도 있을 때와 비슷한 시간이 걸리게 하려고 한 번 대조해보는 더미 해시.
 * (사용자 열거 공격 방지 — 어떤 비밀번호와도 일치하지 않습니다.)
 */
const DUMMY_PASSWORD_HASH = hashPassword(crypto.randomBytes(32).toString('hex'));

function toAppUser(row: UserRow): AppUser {
  return {
    id: row.id,
    email: row.email,
    name: row.name,
    role: row.role as UserRole,
    status: row.status as UserStatus,
    mustChangePassword: row.mustChangePassword,
    lastLoginAt: row.lastLoginAt ? row.lastLoginAt.toISOString() : undefined,
    createdAt: row.createdAt.toISOString(),
  };
}

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
    // 계정 생성은 관리자만 할 수 있으므로, 최초 1회는 시스템이 관리자를 만들어준다.
    this.ensureBootstrapAdmin().catch((err) => console.error('첫 관리자 계정 확인 실패:', err));
    this.purgeExpiredSessions().catch(() => undefined);
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

  // ---------------------------------------------------------------------
  // 사용자 · 세션 (USERS & SESSIONS)
  // ---------------------------------------------------------------------

  /**
   * 사용자가 한 명도 없으면 첫 관리자 계정을 만든다.
   *
   * 계정 생성 경로가 "관리자만"이므로, 최초 1회는 시스템이 만들어줘야 합니다.
   * 초기 비밀번호는 콘솔에 한 번만 찍히고 DB 에는 해시만 남습니다.
   */
  public async ensureBootstrapAdmin(): Promise<void> {
    try {
      if ((await prisma.user.count()) > 0) return;

      const email = (process.env.ADMIN_EMAIL || 'admin@queenkitchen.kr').toLowerCase();
      const password = process.env.ADMIN_PASSWORD || generateInitialPassword();

      await prisma.user.create({
        data: {
          email,
          name: '시스템 관리자',
          role: 'ADMIN',
          passwordHash: hashPassword(password),
          // .env 로 지정한 비밀번호라면 이미 관리자가 정한 값이므로 변경을 강요하지 않는다.
          mustChangePassword: !process.env.ADMIN_PASSWORD,
        },
      });

      console.log('\n──────────── 첫 관리자 계정을 생성했습니다 ────────────');
      console.log(`  이메일   : ${email}`);
      if (!process.env.ADMIN_PASSWORD) {
        console.log(`  비밀번호 : ${password}   ← 이 값은 다시 표시되지 않습니다`);
        console.log('  첫 로그인 후 비밀번호를 변경해야 합니다.');
      } else {
        console.log('  비밀번호 : .env 의 ADMIN_PASSWORD 값');
      }
      console.log('────────────────────────────────────────────────────\n');
    } catch (err: any) {
      console.error('첫 관리자 계정 생성 실패:', err.message);
    }
  }

  /**
   * 자동 로그인용 기본 관리자 계정을 조회하거나 없으면 생성한다.
   */
  public async getOrCreateDefaultAdmin(): Promise<AuthUser | null> {
    try {
      const preferredEmails = [
        (process.env.ADMIN_EMAIL || '').toLowerCase(),
        'admin@queen.com',
        'admin@queenkitchen.kr',
      ].filter(Boolean);

      for (const email of preferredEmails) {
        const user = await prisma.user.findUnique({ where: { email } });
        if (user) {
          if (user.status !== 'ACTIVE') {
            await prisma.user.update({
              where: { id: user.id },
              data: { status: 'ACTIVE', mustChangePassword: false },
            });
          }
          return {
            id: user.id,
            email: user.email,
            name: user.name,
            role: user.role as UserRole,
            mustChangePassword: false,
          };
        }
      }

      // 다른 활성 ADMIN 계정이 있다면 첫 번째 ADMIN 반환
      const anyAdmin = await prisma.user.findFirst({
        where: { role: 'ADMIN', status: 'ACTIVE' },
        orderBy: { createdAt: 'asc' },
      });
      if (anyAdmin) {
        return {
          id: anyAdmin.id,
          email: anyAdmin.email,
          name: anyAdmin.name,
          role: anyAdmin.role as UserRole,
          mustChangePassword: false,
        };
      }

      // 없으면 기본 관리자 생성
      const defaultEmail = (process.env.ADMIN_EMAIL || 'admin@queen.com').toLowerCase();
      // 공개 저장소에 고정 비밀번호를 두지 않는다. .env 값이 없으면 임의 비밀번호로 만든다.
      const defaultPassword = process.env.ADMIN_PASSWORD || generateInitialPassword();
      const created = await prisma.user.create({
        data: {
          email: defaultEmail,
          name: '관리자',
          role: 'ADMIN',
          passwordHash: hashPassword(defaultPassword),
          status: 'ACTIVE',
          mustChangePassword: false,
        },
      });

      return {
        id: created.id,
        email: created.email,
        name: created.name,
        role: created.role as UserRole,
        mustChangePassword: false,
      };
    } catch (err: any) {
      console.error('기본 관리자 계정 조회/생성 실패:', err.message);
      return null;
    }
  }

  public async getUsers(): Promise<AppUser[]> {
    const rows = await prisma.user.findMany({ orderBy: [{ role: 'asc' }, { createdAt: 'asc' }] });
    return rows.map(toAppUser);
  }

  public async getUserById(id: string): Promise<AppUser | null> {
    const row = await prisma.user.findUnique({ where: { id } });
    return row ? toAppUser(row) : null;
  }

  /**
   * 이메일·비밀번호 검증.
   *
   * 계정이 없을 때도 존재하는 계정과 비슷한 시간이 걸리도록 더미 해시를 한 번
   * 계산합니다. 응답 시간 차이로 가입 여부를 알아내는 걸 막기 위함입니다.
   */
  public async verifyCredentials(
    email: string,
    password: string
  ): Promise<{ status: 'OK'; user: AppUser } | { status: 'INVALID' } | { status: 'DISABLED' }> {
    const row = await prisma.user.findUnique({ where: { email: email.toLowerCase().trim() } });

    if (!row) {
      verifyPassword(password, DUMMY_PASSWORD_HASH);
      return { status: 'INVALID' };
    }
    if (!verifyPassword(password, row.passwordHash)) return { status: 'INVALID' };
    if (row.status !== 'ACTIVE') return { status: 'DISABLED' };

    return { status: 'OK', user: toAppUser(row) };
  }

  public async createUser(input: {
    email: string;
    name: string;
    role: UserRole;
    password: string;
  }): Promise<AppUser> {
    const row = await prisma.user.create({
      data: {
        email: input.email.toLowerCase().trim(),
        name: input.name.trim(),
        role: input.role,
        passwordHash: hashPassword(input.password),
        mustChangePassword: true,
      },
    });
    return toAppUser(row);
  }

  /** 이름·등급·상태 변경. 비활성으로 바뀌면 그 사용자의 세션을 모두 끊는다. */
  public async updateUser(
    id: string,
    updates: { name?: string; role?: UserRole; status?: UserStatus }
  ): Promise<AppUser | null> {
    try {
      const row = await prisma.user.update({
        where: { id },
        data: {
          ...(updates.name !== undefined ? { name: updates.name.trim() } : {}),
          ...(updates.role !== undefined ? { role: updates.role } : {}),
          ...(updates.status !== undefined ? { status: updates.status } : {}),
        },
      });
      if (updates.status === 'DISABLED') {
        await prisma.session.deleteMany({ where: { userId: id } });
      }
      return toAppUser(row);
    } catch {
      return null;
    }
  }

  /**
   * 비밀번호 교체.
   * 기존 세션을 모두 끊어, 비밀번호가 샜더라도 그 세션으로는 더 못 들어오게 합니다.
   * (지금 쓰는 창은 호출부에서 새 세션을 발급해 이어갑니다.)
   */
  public async setPassword(
    id: string,
    password: string,
    opts: { mustChange: boolean }
  ): Promise<boolean> {
    try {
      await prisma.user.update({
        where: { id },
        data: { passwordHash: hashPassword(password), mustChangePassword: opts.mustChange },
      });
      await prisma.session.deleteMany({ where: { userId: id } });
      return true;
    } catch {
      return false;
    }
  }

  public async deleteUser(id: string): Promise<boolean> {
    try {
      await prisma.user.delete({ where: { id } });
      return true;
    } catch {
      return false;
    }
  }

  /** 활성 관리자 수 — 마지막 관리자를 지우거나 강등하는 것을 막는 데 씁니다. */
  public async countActiveAdmins(excludeUserId?: string): Promise<number> {
    return prisma.user.count({
      where: {
        role: 'ADMIN',
        status: 'ACTIVE',
        ...(excludeUserId ? { id: { not: excludeUserId } } : {}),
      },
    });
  }

  public async createSession(userId: string, tokenHash: string, expiresAt: Date, userAgent?: string) {
    await prisma.session.create({
      data: { userId, tokenHash, expiresAt, userAgent: userAgent?.slice(0, 200) ?? null },
    });
    await prisma.user.update({ where: { id: userId }, data: { lastLoginAt: new Date() } });
  }

  /**
   * 세션 토큰 해시로 사용자를 찾는다.
   * 만료됐거나 비활성 계정이면 세션을 지우고 null 을 돌려줍니다.
   */
  public async getUserBySessionToken(tokenHash: string): Promise<AuthUser | null> {
    const session = await prisma.session.findUnique({ where: { tokenHash }, include: { user: true } });
    if (!session) return null;

    if (session.expiresAt.getTime() < Date.now() || session.user.status !== 'ACTIVE') {
      await prisma.session.delete({ where: { id: session.id } }).catch(() => undefined);
      return null;
    }

    const user = toAppUser(session.user);
    return {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      mustChangePassword: user.mustChangePassword,
    };
  }

  public async deleteSession(tokenHash: string): Promise<void> {
    await prisma.session.deleteMany({ where: { tokenHash } });
  }

  /** 만료된 세션 청소 (기동 시 1회) */
  public async purgeExpiredSessions(): Promise<number> {
    const result = await prisma.session.deleteMany({ where: { expiresAt: { lt: new Date() } } });
    return result.count;
  }

  // ---------------------------------------------------------------------
  // AI 파싱 정확도 로그 (AI PARSE LOG)
  //
  // 파싱할 때 한 행을 만들고, 사람이 값을 확정하면 같은 행에 수정 내역을
  // 덧씌웁니다. 확정 전 행은 통계 분모에서 빠집니다.
  // ---------------------------------------------------------------------

  /**
   * 파싱 시점 기록. 실패해도 절대 파싱 응답을 막지 않습니다(로그는 부가 기능).
   * 마이그레이션 전이면 테이블이 없어 실패하므로 그 경우도 조용히 넘깁니다.
   */
  public async createParseLog(input: {
    kind: ParseLogKind;
    telemetry: ParseTelemetry;
    parsedSnapshot: unknown;
    itemCount?: number;
    draftId?: string;
  }): Promise<string | null> {
    try {
      const row = await prisma.aiParseLog.create({
        data: {
          kind: input.kind,
          engine: input.telemetry.engine,
          model: input.telemetry.model,
          latencyMs: input.telemetry.latencyMs,
          promptChars: input.telemetry.promptChars,
          hasAttachment: input.telemetry.hasAttachment,
          errorMessage: input.telemetry.errorMessage ?? null,
          itemCount: input.itemCount ?? null,
          parsedSnapshot: (input.parsedSnapshot ?? {}) as any,
          draftId: input.draftId ?? null,
        },
        select: { id: true },
      });
      return row.id;
    } catch (err: any) {
      console.warn('[AI 파싱 로그] 기록 실패 (파싱 응답에는 영향 없음):', err.message);
      return null;
    }
  }

  /**
   * 사람이 확정한 값을 받아 필드별 수정 내역을 계산해 덧씌웁니다.
   * 같은 로그를 여러 번 확정할 수 있으며(검수 단계 → 발행 단계), 최신 값이 남습니다.
   */
  public async confirmParseLog(
    id: string,
    confirmed: OrderEntity,
    stage: 'REVIEW' | 'PUBLISH',
    draftId?: string
  ): Promise<ParseDiffResult | null> {
    const row = await prisma.aiParseLog.findUnique({ where: { id } });
    if (!row) return null;

    const diff = diffOrderEntity(row.parsedSnapshot as unknown as OrderEntity, confirmed);

    await prisma.aiParseLog.update({
      where: { id },
      data: {
        confirmedSnapshot: confirmed as any,
        confirmStage: stage,
        trackedCount: diff.trackedCount,
        matchedCount: diff.matchedCount,
        correctedCount: diff.correctedCount,
        missingCount: diff.missingCount,
        correctionRate: diff.correctionRate,
        accuracyRate: diff.accuracyRate,
        fieldDiffs: diff.diffs as any,
        confirmedAt: new Date(),
        draftId: draftId ?? row.draftId,
      },
    });

    return diff;
  }

  /** 최근 파싱 이력 (확정 여부 무관) — 폴백 빈도·지연시간 점검용 */
  public async getParseLogs(limit = 50, kind?: ParseLogKind): Promise<AiParseLogSummary[]> {
    const rows = await prisma.aiParseLog.findMany({
      where: kind ? { kind } : undefined,
      orderBy: { createdAt: 'desc' },
      take: Math.min(limit, 200),
      select: {
        id: true,
        kind: true,
        engine: true,
        model: true,
        latencyMs: true,
        promptChars: true,
        hasAttachment: true,
        errorMessage: true,
        itemCount: true,
        confirmStage: true,
        trackedCount: true,
        correctedCount: true,
        missingCount: true,
        correctionRate: true,
        accuracyRate: true,
        confirmedAt: true,
        createdAt: true,
      },
    });

    return rows.map((r) => ({
      id: r.id,
      kind: r.kind as ParseLogKind,
      engine: r.engine as ParseEngine,
      model: r.model,
      latencyMs: r.latencyMs,
      promptChars: r.promptChars,
      hasAttachment: r.hasAttachment,
      errorMessage: r.errorMessage ?? undefined,
      itemCount: r.itemCount ?? undefined,
      confirmStage: (r.confirmStage as AiParseLogSummary['confirmStage']) ?? undefined,
      trackedCount: r.trackedCount ?? undefined,
      correctedCount: r.correctedCount ?? undefined,
      missingCount: r.missingCount ?? undefined,
      correctionRate: r.correctionRate ?? undefined,
      accuracyRate: r.accuracyRate ?? undefined,
      confirmedAt: r.confirmedAt ? r.confirmedAt.toISOString() : undefined,
      createdAt: r.createdAt.toISOString(),
    }));
  }

  /**
   * 기간 내 확정된 주문 파싱 로그를 모아 수정률 지표를 냅니다.
   * 폴백 비율은 확정 여부와 무관하게 전체 파싱 건수 기준으로 셉니다.
   */
  public async getParseAccuracyStats(days = 30): Promise<ParseAccuracyStats & {
    periodDays: number;
    totalParseCount: number;
    fallbackCount: number;
    fallbackRate: number;
    pendingConfirmCount: number;
    averageLatencyMs: number;
  }> {
    const since = new Date(Date.now() - days * 86_400_000);
    const scope = { kind: 'ORDER' as const, createdAt: { gte: since } };

    const all = await prisma.aiParseLog.findMany({
      where: scope,
      select: { engine: true, latencyMs: true, confirmedAt: true },
    });

    const confirmed = await prisma.aiParseLog.findMany({
      where: { ...scope, confirmedAt: { not: null } },
      select: {
        engine: true,
        trackedCount: true,
        matchedCount: true,
        correctedCount: true,
        missingCount: true,
        fieldDiffs: true,
      },
    });

    const stats = summarizeParseLogs(
      confirmed.map((r) => ({
        engine: r.engine,
        trackedCount: r.trackedCount ?? 0,
        matchedCount: r.matchedCount ?? 0,
        correctedCount: r.correctedCount ?? 0,
        missingCount: r.missingCount ?? 0,
        diffs: (r.fieldDiffs as unknown as FieldDiff[]) ?? [],
      }))
    );

    const fallbackCount = all.filter((r) => r.engine !== 'GEMINI').length;
    const totalLatency = all.reduce((sum, r) => sum + r.latencyMs, 0);

    return {
      ...stats,
      periodDays: days,
      totalParseCount: all.length,
      fallbackCount,
      fallbackRate: all.length === 0 ? 0 : Math.round((fallbackCount / all.length) * 1000) / 1000,
      pendingConfirmCount: all.filter((r) => !r.confirmedAt).length,
      averageLatencyMs: all.length === 0 ? 0 : Math.round(totalLatency / all.length),
    };
  }
}

export const db = new PrismaStore();
