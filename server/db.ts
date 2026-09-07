import fs from 'fs';
import path from 'path';
import { PricingItem, QuoteDocument } from '../src/types.js';
import { DEFAULT_PRICING_CATALOG } from './defaultCatalog.js';

const DATA_DIR = path.join(process.cwd(), 'data');
const DB_FILE = path.join(DATA_DIR, 'db.json');

interface DatabaseSchema {
  pricingItems: PricingItem[];
  quotes: QuoteDocument[];
  version: number;
}

class Store {
  private data: DatabaseSchema = {
    pricingItems: [],
    quotes: [],
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
          version: parsed.version || 1,
        };
      } else {
        this.data = {
          pricingItems: [...DEFAULT_PRICING_CATALOG],
          quotes: [],
          version: 1,
        };
        this.save();
      }
    } catch (err) {
      console.error('Error initializing data store, using in-memory defaults:', err);
      this.data = {
        pricingItems: [...DEFAULT_PRICING_CATALOG],
        quotes: [],
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
}

export const db = new Store();
