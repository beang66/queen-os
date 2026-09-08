import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import {
  DraftPayload,
  DraftStatus,
  PricingItem,
  QuoteDocument,
  QuoteDraft,
  QuoteDraftSummary,
} from '../src/types.js';
import { DEFAULT_PRICING_CATALOG } from './defaultCatalog.js';

const DATA_DIR = path.join(process.cwd(), 'data');
const DB_FILE = path.join(DATA_DIR, 'db.json');

/** 초안 1건이 보관하는 최대 변경 이력 수 */
const MAX_DRAFT_HISTORY = 20;
/** 이 기간 동안 수정이 없으면 보관(ARCHIVED) 처리 */
const ARCHIVE_AFTER_DAYS = 30;
/** 보관 상태로 이 기간이 더 지나면 영구 삭제 */
const PURGE_AFTER_DAYS = 90;

interface DatabaseSchema {
  pricingItems: PricingItem[];
  quotes: QuoteDocument[];
  drafts: QuoteDraft[];
  version: number;
}

/**
 * 초안 저장 결과.
 * 판별자를 문자열로 둔 이유: 이 프로젝트는 strictNullChecks 를 켜지 않아
 * boolean 리터럴 판별자로는 타입이 좁혀지지 않는다.
 */
export type DraftSaveResult =
  | { status: 'OK'; draft: QuoteDraft }
  | { status: 'NOT_FOUND' }
  | { status: 'CONFLICT'; current: QuoteDraft };

const daysBetween = (from: string, to: number) => (to - new Date(from).getTime()) / 86_400_000;

class Store {
  private data: DatabaseSchema = {
    pricingItems: [],
    quotes: [],
    drafts: [],
    version: 1,
  };

  constructor() {
    this.init();
  }

  private init() {
    try {
      if (!fs.existsSync(DATA_DIR)) {
        fs.mkdirSync(DATA_DIR, { recursive: true });
      }

      if (fs.existsSync(DB_FILE)) {
        const raw = fs.readFileSync(DB_FILE, 'utf-8');
        const parsed = JSON.parse(raw);
        this.data = {
          pricingItems: Array.isArray(parsed.pricingItems) && parsed.pricingItems.length > 0
            ? parsed.pricingItems
            : [...DEFAULT_PRICING_CATALOG],
          quotes: Array.isArray(parsed.quotes) ? parsed.quotes : [],
          drafts: Array.isArray(parsed.drafts) ? parsed.drafts : [],
          version: parsed.version || 1,
        };
      } else {
        this.data = {
          pricingItems: [...DEFAULT_PRICING_CATALOG],
          quotes: [],
          drafts: [],
          version: 1,
        };
        this.save();
      }
      this.runDraftRetention();
    } catch (err) {
      console.error('Error initializing data store, using in-memory defaults:', err);
      this.data = {
        pricingItems: [...DEFAULT_PRICING_CATALOG],
        quotes: [],
        drafts: [],
        version: 1,
      };
    }
  }

  private save() {
    try {
      if (!fs.existsSync(DATA_DIR)) {
        fs.mkdirSync(DATA_DIR, { recursive: true });
      }
      fs.writeFileSync(DB_FILE, JSON.stringify(this.data, null, 2), 'utf-8');
    } catch (err) {
      console.error('Failed to write db.json:', err);
    }
  }

  // PRICING CRUD
  public getPricingItems(search?: string, category?: string): PricingItem[] {
    let items = [...this.data.pricingItems];
    if (category && category !== 'ALL') {
      items = items.filter((i) => i.category === category);
    }
    if (search && search.trim()) {
      const q = search.toLowerCase().trim();
      items = items.filter(
        (i) =>
          i.name.toLowerCase().includes(q) ||
          i.code.toLowerCase().includes(q) ||
          i.material.toLowerCase().includes(q) ||
          i.spec.toLowerCase().includes(q) ||
          i.supplier.toLowerCase().includes(q)
      );
    }
    return items;
  }

  public getPricingItemById(id: string): PricingItem | undefined {
    return this.data.pricingItems.find((i) => i.id === id);
  }

  public getPricingItemByCode(code: string): PricingItem | undefined {
    return this.data.pricingItems.find((i) => i.code.toLowerCase() === code.toLowerCase());
  }

  public addPricingItem(item: Omit<PricingItem, 'id' | 'updatedAt'>): PricingItem {
    const newItem: PricingItem = {
      ...item,
      id: `prc-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      updatedAt: new Date().toISOString(),
    };
    this.data.pricingItems.unshift(newItem);
    this.save();
    return newItem;
  }

  public updatePricingItem(id: string, updates: Partial<PricingItem>): PricingItem | null {
    const index = this.data.pricingItems.findIndex((i) => i.id === id);
    if (index === -1) return null;

    this.data.pricingItems[index] = {
      ...this.data.pricingItems[index],
      ...updates,
      updatedAt: new Date().toISOString(),
    };
    this.save();
    return this.data.pricingItems[index];
  }

  public deletePricingItem(id: string): boolean {
    const prevLen = this.data.pricingItems.length;
    this.data.pricingItems = this.data.pricingItems.filter((i) => i.id !== id);
    if (this.data.pricingItems.length !== prevLen) {
      this.save();
      return true;
    }
    return false;
  }

  public bulkUpsertPricingItems(items: Array<Omit<PricingItem, 'id' | 'updatedAt'>>): { added: number; updated: number } {
    let added = 0;
    let updated = 0;

    for (const item of items) {
      const existing = this.data.pricingItems.find(
        (i) => i.code.toLowerCase() === item.code.toLowerCase() || i.name.toLowerCase() === item.name.toLowerCase()
      );
      if (existing) {
        Object.assign(existing, item, { updatedAt: new Date().toISOString() });
        updated++;
      } else {
        const newItem: PricingItem = {
          ...item,
          id: `prc-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
          updatedAt: new Date().toISOString(),
        };
        this.data.pricingItems.unshift(newItem);
        added++;
      }
    }
    this.save();
    return { added, updated };
  }

  public resetPricingCatalog(): PricingItem[] {
    this.data.pricingItems = JSON.parse(JSON.stringify(DEFAULT_PRICING_CATALOG));
    this.save();
    return this.data.pricingItems;
  }

  // QUOTES CRUD & AUDIT
  public getQuotes(status?: string, search?: string): QuoteDocument[] {
    let quotes = [...this.data.quotes];
    if (status && status !== 'ALL') {
      quotes = quotes.filter((q) => q.status === status);
    }
    if (search && search.trim()) {
      const s = search.toLowerCase().trim();
      quotes = quotes.filter(
        (q) =>
          q.quoteNumber.toLowerCase().includes(s) ||
          q.title.toLowerCase().includes(s) ||
          q.orderEntity.customerName.toLowerCase().includes(s) ||
          q.orderEntity.address.toLowerCase().includes(s) ||
          q.orderEntity.contact.includes(s)
      );
    }
    return quotes.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }

  public getQuoteById(id: string): QuoteDocument | undefined {
    return this.data.quotes.find((q) => q.id === id || q.quoteNumber === id);
  }

  public saveQuote(quote: Omit<QuoteDocument, 'id' | 'createdAt' | 'updatedAt' | 'quoteNumber'> & { quoteNumber?: string }): QuoteDocument {
    const todayStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const todaysCount = this.data.quotes.filter((q) => q.createdAt.startsWith(new Date().toISOString().slice(0, 10))).length + 1;
    const generatedNumber = quote.quoteNumber || `QN-${todayStr}-${String(todaysCount).padStart(3, '0')}`;

    const newQuote: QuoteDocument = {
      ...quote,
      id: `quote-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      quoteNumber: generatedNumber,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    this.data.quotes.unshift(newQuote);
    this.save();
    return newQuote;
  }

  public updateQuote(id: string, updates: Partial<QuoteDocument>): QuoteDocument | null {
    const index = this.data.quotes.findIndex((q) => q.id === id);
    if (index === -1) return null;

    this.data.quotes[index] = {
      ...this.data.quotes[index],
      ...updates,
      updatedAt: new Date().toISOString(),
    };
    this.save();
    return this.data.quotes[index];
  }

  public deleteQuote(id: string): boolean {
    const prevLen = this.data.quotes.length;
    this.data.quotes = this.data.quotes.filter((q) => q.id !== id);
    if (this.data.quotes.length !== prevLen) {
      this.save();
      return true;
    }
    return false;
  }

  // -------------------------------------------------------------------------
  // 견적 초안 (DRAFTS)
  // -------------------------------------------------------------------------

  /**
   * 단가표의 지문(fingerprint).
   * 가격·단위에 영향을 주는 필드만 해싱하므로, 메모 수정 등으로는 값이 바뀌지 않는다.
   * 초안에 기록해 두었다가 나중에 비교해 "단가가 바뀌었으니 다시 계산" 안내에 사용한다.
   */
  public getPricingFingerprint(): string {
    const material = this.data.pricingItems
      .map((i) => `${i.id}:${i.code}:${i.costPrice}:${i.sellingPrice}:${i.unit}`)
      .sort()
      .join('|');
    return crypto.createHash('sha1').update(material).digest('hex').slice(0, 16);
  }

  private toDraftSummary(d: QuoteDraft): QuoteDraftSummary {
    return {
      id: d.id,
      revision: d.revision,
      status: d.status,
      createdAt: d.createdAt,
      updatedAt: d.updatedAt,
      step: d.payload.step,
      customerName: d.payload.orderEntity?.customerName ?? '',
      projectName: d.payload.orderEntity?.projectName ?? '',
      quoteTitle: d.payload.quoteTitle ?? '',
      itemCount: d.payload.reviewItems?.length ?? 0,
      totalAmount: d.payload.calculationResult?.summary?.finalGrandTotal ?? null,
      publishedQuoteIds: d.publishedQuoteIds ?? [],
    };
  }

  public createDraft(payload: DraftPayload, editorId: string): QuoteDraft {
    const now = new Date().toISOString();
    const draft: QuoteDraft = {
      id: `draft-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      revision: 1,
      status: 'ACTIVE',
      createdAt: now,
      updatedAt: now,
      lastEditorId: editorId,
      payload,
      history: [{ revision: 1, savedAt: now, label: '초안 생성', payload }],
      pricingFingerprint: this.getPricingFingerprint(),
      publishedQuoteIds: [],
    };
    this.data.drafts.unshift(draft);
    this.save();
    return draft;
  }

  public getDrafts(status?: DraftStatus | 'ALL'): QuoteDraftSummary[] {
    let drafts = [...this.data.drafts];
    if (status && status !== 'ALL') {
      drafts = drafts.filter((d) => d.status === status);
    }
    return drafts
      .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
      .map((d) => this.toDraftSummary(d));
  }

  public getDraftById(id: string): QuoteDraft | undefined {
    return this.data.drafts.find((d) => d.id === id);
  }

  /**
   * 초안 저장. 낙관적 잠금:
   * 클라이언트가 보낸 revision 이 서버 최신본과 다르면 덮어쓰지 않고 CONFLICT 를 돌려준다.
   * (같은 초안을 여러 창에서 열어 둔 경우를 감지하기 위함)
   */
  public saveDraft(
    id: string,
    args: { revision: number; payload: DraftPayload; label?: string; editorId: string }
  ): DraftSaveResult {
    const index = this.data.drafts.findIndex((d) => d.id === id);
    if (index === -1) return { status: 'NOT_FOUND' };

    const current = this.data.drafts[index];
    if (args.revision !== current.revision) {
      return { status: 'CONFLICT', current };
    }

    const now = new Date().toISOString();
    const nextRevision = current.revision + 1;
    const entry = {
      revision: nextRevision,
      savedAt: now,
      label: args.label || '자동 저장',
      payload: args.payload,
    };

    const updated: QuoteDraft = {
      ...current,
      revision: nextRevision,
      updatedAt: now,
      lastEditorId: args.editorId,
      payload: args.payload,
      history: [...current.history, entry].slice(-MAX_DRAFT_HISTORY),
      // 계산 결과가 갱신된 저장이라면 단가 지문도 함께 갱신한다.
      pricingFingerprint:
        args.payload.calculationResult &&
        args.payload.calculationResult.calculatedAt !== current.payload.calculationResult?.calculatedAt
          ? this.getPricingFingerprint()
          : current.pricingFingerprint,
    };

    this.data.drafts[index] = updated;
    this.save();
    return { status: 'OK', draft: updated };
  }

  /** 과거 저장 시점으로 되돌린다 (복구 자체도 새 revision 으로 기록). */
  public restoreDraftRevision(id: string, revision: number, editorId: string): QuoteDraft | null {
    const index = this.data.drafts.findIndex((d) => d.id === id);
    if (index === -1) return null;

    const current = this.data.drafts[index];
    const target = current.history.find((h) => h.revision === revision);
    if (!target) return null;

    const now = new Date().toISOString();
    const nextRevision = current.revision + 1;
    const updated: QuoteDraft = {
      ...current,
      revision: nextRevision,
      updatedAt: now,
      lastEditorId: editorId,
      status: current.status === 'ARCHIVED' ? 'ACTIVE' : current.status,
      payload: target.payload,
      history: [
        ...current.history,
        { revision: nextRevision, savedAt: now, label: `rev.${revision} 상태로 복구`, payload: target.payload },
      ].slice(-MAX_DRAFT_HISTORY),
    };

    this.data.drafts[index] = updated;
    this.save();
    return updated;
  }

  public deleteDraft(id: string): boolean {
    const prevLen = this.data.drafts.length;
    this.data.drafts = this.data.drafts.filter((d) => d.id !== id);
    if (this.data.drafts.length !== prevLen) {
      this.save();
      return true;
    }
    return false;
  }

  /** 견적서가 발행되면 초안을 PUBLISHED 로 전환하고 발행 문서 id 를 연결한다. */
  public markDraftPublished(id: string, quoteId: string): QuoteDraft | null {
    const index = this.data.drafts.findIndex((d) => d.id === id);
    if (index === -1) return null;

    const current = this.data.drafts[index];
    const updated: QuoteDraft = {
      ...current,
      status: 'PUBLISHED',
      updatedAt: new Date().toISOString(),
      publishedQuoteIds: [...current.publishedQuoteIds, quoteId],
    };
    this.data.drafts[index] = updated;
    this.save();
    return updated;
  }

  /**
   * 보관·폐기 정책.
   * ACTIVE 인데 30일 이상 수정이 없으면 ARCHIVED 로, ARCHIVED 상태로 90일이 더 지나면 삭제한다.
   * 발행 완료(PUBLISHED)된 초안은 이력 가치가 있으므로 보관만 하고 삭제하지 않는다.
   */
  public runDraftRetention(): { archived: number; purged: number } {
    const now = Date.now();
    let archived = 0;
    let purged = 0;

    for (const draft of this.data.drafts) {
      if (draft.status === 'ACTIVE' && daysBetween(draft.updatedAt, now) > ARCHIVE_AFTER_DAYS) {
        draft.status = 'ARCHIVED';
        archived++;
      }
    }

    const before = this.data.drafts.length;
    this.data.drafts = this.data.drafts.filter((d) => {
      if (d.status !== 'ARCHIVED') return true;
      if (d.publishedQuoteIds.length > 0) return true;
      return daysBetween(d.updatedAt, now) <= ARCHIVE_AFTER_DAYS + PURGE_AFTER_DAYS;
    });
    purged = before - this.data.drafts.length;

    if (archived > 0 || purged > 0) {
      this.save();
      console.log(`[초안 정리] 보관 전환 ${archived}건, 영구 삭제 ${purged}건`);
    }
    return { archived, purged };
  }
}

export const db = new Store();
