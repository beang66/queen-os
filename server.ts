import express from 'express';
import http from 'http';
import path from 'path';
import dotenv from 'dotenv';
import multer from 'multer';
import { createServer as createViteServer } from 'vite';
import { db } from './server/db.js';
import { calculateDeterministicQuote } from './server/calculationEngine.js';
import { parseCustomerOrder, parseUnstructuredDocument } from './server/geminiService.js';
import { parseBody, parseQuery } from './server/validate.js';
import {
  CalculateQuoteSchema,
  CreateDraftSchema,
  DraftListQuerySchema,
  PricingBulkSchema,
  PricingItemInputSchema,
  PricingItemUpdateSchema,
  RestoreDraftSchema,
  SaveDraftSchema,
  SaveQuoteSchema,
  UpdateQuoteSchema,
} from './src/schemas.js';
import * as XLSX from 'xlsx';

dotenv.config();

const app = express();
const PORT = 3000;

// Multer memory storage for file uploads
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 25 * 1024 * 1024 }, // 25MB
});

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// ----------------------------------------------------
// 1. HEALTH & METADATA
// ----------------------------------------------------
app.get('/api/health', (_req, res) => {
  res.json({
    status: 'ok',
    system: '퀸 주방가구 견적 및 원가 자동화 시스템 (Queen Kitchen Furniture Automation)',
    version: '1.0.0',
    timestamp: new Date().toISOString(),
  });
});

// ----------------------------------------------------
// 2. PRICING DB ENDPOINTS
// ----------------------------------------------------
app.get('/api/pricing', async (req, res) => {
  try {
    const { search, category } = req.query;
    const items = await db.getPricingItems(search as string, category as string);
    res.json({ success: true, count: items.length, data: items });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 단가표 지문 — 초안에 기록된 값과 비교해 "단가가 바뀌었는지" 판별한다.
// 주의: '/api/pricing/:id' 보다 먼저 선언해야 :id 로 잡히지 않는다.
app.get('/api/pricing/fingerprint', async (_req, res) => {
  res.json({ success: true, data: { fingerprint: await db.getPricingFingerprint() } });
});

app.get('/api/pricing/:id', async (req, res) => {
  try {
    const item = await db.getPricingItemById(req.params.id);
    if (!item) {
      return res.status(404).json({ success: false, error: '품목을 찾을 수 없습니다.' });
    }
    res.json({ success: true, data: item });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.post('/api/pricing', async (req, res) => {
  try {
    const body = parseBody(PricingItemInputSchema, req, res);
    if (!body) return;

    const created = await db.addPricingItem({
      code: body.code || `ITEM-${Date.now().toString().slice(-4)}`,
      category: body.category || 'ACCESSORY',
      name: body.name,
      spec: body.spec || '',
      material: body.material || '',
      unit: body.unit,
      costPrice: body.costPrice,
      sellingPrice: body.sellingPrice,
      supplier: body.supplier || '퀸 퍼니처',
      stockStatus: body.stockStatus || 'INSTOCK',
      notes: body.notes || '',
    });
    res.json({ success: true, data: created });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.put('/api/pricing/:id', async (req, res) => {
  try {
    const body = parseBody(PricingItemUpdateSchema, req, res);
    if (!body) return;

    const updated = await db.updatePricingItem(req.params.id, body);
    if (!updated) {
      return res.status(404).json({ success: false, error: '해당 품목을 찾을 수 없습니다.' });
    }
    res.json({ success: true, data: updated });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.delete('/api/pricing/:id', async (req, res) => {
  try {
    const success = await db.deletePricingItem(req.params.id);
    res.json({ success });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.post('/api/pricing/bulk', async (req, res) => {
  try {
    const body = parseBody(PricingBulkSchema, req, res);
    if (!body) return;

    const result = await db.bulkUpsertPricingItems(
      body.items.map((i) => ({
        code: i.code,
        category: i.category || 'ACCESSORY',
        name: i.name,
        spec: i.spec || '',
        material: i.material || '',
        unit: i.unit,
        costPrice: i.costPrice,
        sellingPrice: i.sellingPrice,
        supplier: i.supplier || '퀸 퍼니처',
        stockStatus: i.stockStatus || 'INSTOCK',
        notes: i.notes || '',
      }))
    );
    const currentItems = await db.getPricingItems();
    res.json({ success: true, ...result, currentTotal: currentItems.length });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.post('/api/pricing/reset-seed', async (_req, res) => {
  try {
    const items = await db.resetPricingCatalog();
    res.json({ success: true, message: '퀸 주방가구 표준 단가표 카탈로그로 초기화되었습니다.', count: items.length });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ----------------------------------------------------
// 3. GEMINI MULTIMODAL EXTRACTION ENDPOINTS
// ----------------------------------------------------
app.post('/api/gemini/parse-doc', upload.single('file'), async (req, res) => {
  try {
    const promptText = req.body.prompt || '';
    let base64File: string | undefined;
    let mimeType: string | undefined;

    if (req.file) {
      base64File = req.file.buffer.toString('base64');
      mimeType = req.file.mimetype;
    } else if (req.body.base64File && req.body.mimeType) {
      base64File = req.body.base64File;
      mimeType = req.body.mimeType;
    }

    const extraction = await parseUnstructuredDocument(promptText, base64File, mimeType);
    res.json({ success: true, data: extraction });
  } catch (err: any) {
    console.error('Document parsing endpoint error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

app.post('/api/gemini/parse-order', upload.single('image'), async (req, res) => {
  try {
    const promptText = req.body.prompt || '';
    let base64Image: string | undefined;
    let mimeType: string | undefined;

    if (req.file) {
      base64Image = req.file.buffer.toString('base64');
      mimeType = req.file.mimetype;
    } else if (req.body.base64Image && req.body.mimeType) {
      base64Image = req.body.base64Image;
      mimeType = req.body.mimeType;
    }

    const orderEntity = await parseCustomerOrder(promptText, base64Image, mimeType);
    res.json({ success: true, data: orderEntity });
  } catch (err: any) {
    console.error('Order parsing endpoint error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// ----------------------------------------------------
// 4. DETERMINISTIC QUOTE CALCULATION ENGINE
// ----------------------------------------------------
app.post('/api/quote/calculate', async (req, res) => {
  try {
    const body = parseBody(CalculateQuoteSchema, req, res);
    if (!body) return;

    const calculationResult = await calculateDeterministicQuote(body.orderEntity);

    res.json({ success: true, data: calculationResult });
  } catch (err: any) {
    console.error('Calculation error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// ----------------------------------------------------
// 5. QUOTE DOCUMENT PERSISTENCE & AUDIT
// ----------------------------------------------------
app.get('/api/quotes', async (req, res) => {
  try {
    const { status, search } = req.query;
    const quotes = await db.getQuotes(status as string, search as string);
    res.json({ success: true, count: quotes.length, data: quotes });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.get('/api/quotes/:id', async (req, res) => {
  try {
    const quote = await db.getQuoteById(req.params.id);
    if (!quote) {
      return res.status(404).json({ success: false, error: '견적서를 찾을 수 없습니다.' });
    }
    res.json({ success: true, data: quote });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.post('/api/quotes', async (req, res) => {
  try {
    const body = parseBody(SaveQuoteSchema, req, res);
    if (!body) return;

    const { orderEntity, calculationResult, draftId } = body;

    const saved = await db.saveQuote({
      title: body.title || `${orderEntity.customerName} 고객님 주방가구 맞춤 견적서`,
      status: body.status || 'ISSUED',
      targetMarginRate: body.targetMarginRate ?? 28,
      version: body.version ?? 1,
      parentQuoteId: body.parentQuoteId || undefined,
      publishMeta: body.publishMeta || undefined,
      quoteNumber: body.quoteNumber || undefined,
      orderEntity,
      calculationResult,
      notes: body.notes || '',
      companyInfo: {
        name: '퀸 주방가구 (Queen Kitchen)',
        representative: '김대표',
        bizNumber: '123-45-67890',
        address: '경기도 남양주시 화도읍 가구공단로 88',
        phone: '031-595-1234 / 010-8888-9999',
        email: 'queenkitchen@furniture.kr',
      },
    });

    // 초안에서 발행한 경우 초안을 PUBLISHED 로 전환하고 발행 문서를 연결한다.
    if (draftId) {
      await db.markDraftPublished(draftId, saved.id);
    }

    res.json({ success: true, data: saved });
  } catch (err: any) {
    console.error('Save quote error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

app.put('/api/quotes/:id', async (req, res) => {
  try {
    const body = parseBody(UpdateQuoteSchema, req, res);
    if (!body) return;

    const updated = await db.updateQuote(req.params.id, body);
    if (!updated) {
      return res.status(404).json({ success: false, error: '해당 견적서를 찾을 수 없습니다.' });
    }
    res.json({ success: true, data: updated });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.delete('/api/quotes/:id', async (req, res) => {
  try {
    const success = await db.deleteQuote(req.params.id);
    res.json({ success });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ----------------------------------------------------
// 6. QUOTE DRAFT (견적 초안) — 작성 중 데이터 유실 방지
// ----------------------------------------------------
app.post('/api/drafts', async (req, res) => {
  try {
    const body = parseBody(CreateDraftSchema, req, res);
    if (!body) return;

    const draft = await db.createDraft(body.payload, body.editorId || 'unknown');
    res.json({ success: true, data: draft });
  } catch (err: any) {
    console.error('Create draft error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

app.get('/api/drafts', async (req, res) => {
  try {
    const query = parseQuery(DraftListQuerySchema, req, res);
    if (!query) return;

    res.json({ success: true, data: await db.getDrafts(query.status) });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.get('/api/drafts/:id', async (req, res) => {
  try {
    const draft = await db.getDraftById(req.params.id);
    if (!draft) {
      return res.status(404).json({ success: false, error: '해당 초안을 찾을 수 없습니다.' });
    }
    const currentPricingFingerprint = await db.getPricingFingerprint();
    res.json({
      success: true,
      data: draft,
      // 초안 저장 당시의 단가표와 현재 단가표가 다른지 함께 알려준다.
      meta: {
        currentPricingFingerprint,
        pricingChanged: !!draft.pricingFingerprint && draft.pricingFingerprint !== currentPricingFingerprint,
      },
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.put('/api/drafts/:id', async (req, res) => {
  try {
    const body = parseBody(SaveDraftSchema, req, res);
    if (!body) return;

    const result = await db.saveDraft(req.params.id, {
      revision: body.revision,
      payload: body.payload,
      label: body.label,
      editorId: body.editorId || 'unknown',
    });

    if (result.status === 'OK') {
      return res.json({ success: true, data: result.draft });
    }
    if (result.status === 'NOT_FOUND') {
      return res.status(404).json({ success: false, error: '해당 초안을 찾을 수 없습니다.' });
    }
    // 다른 창에서 먼저 저장한 경우 — 덮어쓰지 않고 서버 최신본을 함께 돌려준다.
    return res.status(409).json({
      success: false,
      error: '다른 창에서 이 초안을 먼저 수정했습니다.',
      conflict: true,
      data: result.current,
    });
  } catch (err: any) {
    console.error('Save draft error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

app.post('/api/drafts/:id/restore', async (req, res) => {
  try {
    const body = parseBody(RestoreDraftSchema, req, res);
    if (!body) return;

    const restored = await db.restoreDraftRevision(req.params.id, body.revision, body.editorId || 'unknown');
    if (!restored) {
      return res.status(404).json({ success: false, error: '해당 초안 또는 저장 시점을 찾을 수 없습니다.' });
    }
    res.json({ success: true, data: restored });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.delete('/api/drafts/:id', async (req, res) => {
  try {
    res.json({ success: await db.deleteDraft(req.params.id) });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ----------------------------------------------------
// 7. EXCEL EXPORT ENDPOINT
// ----------------------------------------------------
app.post('/api/export/quote-excel', (req, res) => {
  try {
    const quote = req.body;
    if (!quote || !quote.calculationResult) {
      return res.status(400).json({ success: false, error: '유효한 견적서 데이터가 필요합니다.' });
    }

    const rows = [
      ['퀸 주방가구 공종별 상세 견적서'],
      ['견적번호', quote.quoteNumber || '임시견적', '발행일자', new Date().toLocaleDateString('ko-KR')],
      ['고객명', quote.orderEntity?.customerName || '', '연락처', quote.orderEntity?.contact || ''],
      ['현장주소', quote.orderEntity?.address || '', '가구형태', quote.orderEntity?.layoutType || ''],
      [],
      ['순번', '구분', '품목코드', '품목명 및 사양', '산식/규격', '단위', '수량', '제조원가(단가)', '제조원가(합계)', '공급단가', '공급가액(합계)', '마진율(%)'],
    ];

    quote.calculationResult.breakdowns.forEach((item: any, idx: number) => {
      rows.push([
        idx + 1,
        item.category,
        item.code,
        item.name,
        item.formula,
        item.unit,
        item.quantity,
        item.costUnitPrice,
        item.costTotal,
        item.sellingUnitPrice,
        item.sellingTotal,
        `${item.marginRate}%`,
      ]);
    });

    rows.push([]);
    const summary = quote.calculationResult.summary;
    rows.push(['', '', '', '총 제조원가 (VAT별도)', '', '', '', '', summary.totalManufacturingCost, '', '', '']);
    rows.push(['', '', '', '총 공급가액 (VAT별도)', '', '', '', '', '', '', summary.totalSellingPrice, '']);
    rows.push(['', '', '', '총 마진액 / 평균 마진율', '', '', '', '', summary.totalMarginAmount, '', '', `${summary.averageMarginRate}%`]);
    rows.push(['', '', '', '부가가치세 (VAT 10%)', '', '', '', '', '', '', summary.vatAmount, '']);
    rows.push(['', '', '', '최종 견적 총액 (VAT포함)', '', '', '', '', '', '', summary.finalGrandTotal, '']);

    const ws = XLSX.utils.aoa_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, '견적서_상세');

    const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });

    res.setHeader('Content-Disposition', `attachment; filename="queen_quote_${quote.quoteNumber || 'draft'}.xlsx"`);
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.send(buffer);
  } catch (err: any) {
    console.error('Excel export error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// ----------------------------------------------------
// 8. VITE MIDDLEWARE / STATIC ASSETS
// ----------------------------------------------------
async function startServer() {
  // Express 를 감싼 HTTP 서버를 직접 만든다. Vite HMR 웹소켓을 이 서버에 얹기 위함.
  const httpServer = http.createServer(app);

  if (process.env.NODE_ENV !== 'production') {
    // vite.config.ts 의 /api 프록시는 `vite` 단독 실행(:5173) 전용이다.
    // 미들웨어 모드에서는 이 서버 자신을 가리키는 자기참조 프록시가 되므로 끈다.
    process.env.QUEEN_MIDDLEWARE_MODE = 'true';

    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        // HMR 웹소켓을 별도 포트(:24678)가 아니라 이 HTTP 서버(:3000)에 얹는다.
        // 별도 포트를 쓰면 개발 서버가 중복 실행됐을 때 서로 포트를 뺏고 뺏기며
        // 브라우저의 HMR 소켓이 끊길 때마다 Vite 클라이언트가 페이지를 새로고침한다.
        hmr: { server: httpServer },
      },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    // SPA fallback: Express 5 removed bare '*' routes, so use a terminal middleware.
    app.use((_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  httpServer.on('error', (err: NodeJS.ErrnoException) => {
    if (err.code === 'EADDRINUSE') {
      console.error(`\n[오류] 포트 ${PORT} 가 이미 사용 중입니다. 개발 서버가 이미 실행 중인지 확인하세요.`);
      console.error(`이 프로세스를 종료합니다. 브라우저에서 http://localhost:${PORT} 로 접속하세요.\n`);
      process.exit(1);
    }
    throw err;
  });

  httpServer.listen(PORT, '0.0.0.0', () => {
    console.log(`퀸 주방가구 견적/원가 자동화 서버 구동 완료: http://0.0.0.0:${PORT}`);
  });
}

startServer();
