import express from 'express';
import path from 'path';
import dotenv from 'dotenv';
import multer from 'multer';
import { createServer as createViteServer } from 'vite';
import { db } from './server/db.js';
import { calculateDeterministicQuote } from './server/calculationEngine.js';
import { parseCustomerOrder, parseUnstructuredDocument } from './server/geminiService.js';
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
app.get('/api/health', (req, res) => {
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
app.get('/api/pricing', (req, res) => {
  try {
    const { search, category } = req.query;
    const items = db.getPricingItems(search as string, category as string);
    res.json({ success: true, count: items.length, data: items });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.get('/api/pricing/:id', (req, res) => {
  try {
    const item = db.getPricingItemById(req.params.id);
    if (!item) {
      return res.status(404).json({ success: false, error: '품목을 찾을 수 없습니다.' });
    }
    res.json({ success: true, data: item });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.post('/api/pricing', (req, res) => {
  try {
    const { code, category, name, spec, material, unit, costPrice, sellingPrice, supplier, stockStatus, notes } = req.body;
    if (!name || !unit || costPrice === undefined || sellingPrice === undefined) {
      return res.status(400).json({ success: false, error: '필수 입력 항목(품목명, 단위, 원가, 출고가)이 누락되었습니다.' });
    }
    const created = db.addPricingItem({
      code: code || `ITEM-${Date.now().toString().slice(-4)}`,
      category: category || 'ACCESSORY',
      name,
      spec: spec || '',
      material: material || '',
      unit,
      costPrice: Number(costPrice) || 0,
      sellingPrice: Number(sellingPrice) || 0,
      supplier: supplier || '퀸 퍼니처',
      stockStatus: stockStatus || 'INSTOCK',
      notes: notes || '',
    });
    res.json({ success: true, data: created });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.put('/api/pricing/:id', (req, res) => {
  try {
    const updated = db.updatePricingItem(req.params.id, req.body);
    if (!updated) {
      return res.status(404).json({ success: false, error: '해당 품목을 찾을 수 없습니다.' });
    }
    res.json({ success: true, data: updated });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.delete('/api/pricing/:id', (req, res) => {
  try {
    const success = db.deletePricingItem(req.params.id);
    res.json({ success });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.post('/api/pricing/bulk', (req, res) => {
  try {
    const { items } = req.body;
    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ success: false, error: '일괄 등록할 항목 목록이 비어있습니다.' });
    }
    const result = db.bulkUpsertPricingItems(items);
    res.json({ success: true, ...result, currentTotal: db.getPricingItems().length });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.post('/api/pricing/reset-seed', (req, res) => {
  try {
    const items = db.resetPricingCatalog();
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
app.post('/api/quote/calculate', (req, res) => {
  try {
    const { orderEntity, targetMarginRate } = req.body;
    if (!orderEntity) {
      return res.status(400).json({ success: false, error: '주문 정보(orderEntity)가 필요합니다.' });
    }

    const calculationResult = calculateDeterministicQuote(
      orderEntity,
      targetMarginRate ? Number(targetMarginRate) : 28
    );

    res.json({ success: true, data: calculationResult });
  } catch (err: any) {
    console.error('Calculation error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// ----------------------------------------------------
// 5. QUOTE DOCUMENT PERSISTENCE & AUDIT
// ----------------------------------------------------
app.get('/api/quotes', (req, res) => {
  try {
    const { status, search } = req.query;
    const quotes = db.getQuotes(status as string, search as string);
    res.json({ success: true, count: quotes.length, data: quotes });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.get('/api/quotes/:id', (req, res) => {
  try {
    const quote = db.getQuoteById(req.params.id);
    if (!quote) {
      return res.status(404).json({ success: false, error: '견적서를 찾을 수 없습니다.' });
    }
    res.json({ success: true, data: quote });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.post('/api/quotes', (req, res) => {
  try {
    const { title, status, targetMarginRate, orderEntity, calculationResult, notes } = req.body;
    if (!orderEntity || !calculationResult) {
      return res.status(400).json({ success: false, error: '주문 정보와 계산 결과가 누락되었습니다.' });
    }

    const saved = db.saveQuote({
      title: title || `${orderEntity.customerName} 고객님 주방가구 맞춤 견적서`,
      status: status || 'ISSUED',
      targetMarginRate: Number(targetMarginRate) || 28,
      orderEntity,
      calculationResult,
      notes: notes || '',
      companyInfo: {
        name: '퀸 주방가구 (Queen Kitchen)',
        representative: '김대표',
        bizNumber: '123-45-67890',
        address: '경기도 남양주시 화도읍 가구공단로 88',
        phone: '031-595-1234 / 010-8888-9999',
        email: 'queenkitchen@furniture.kr',
      },
    });

    res.json({ success: true, data: saved });
  } catch (err: any) {
    console.error('Save quote error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

app.put('/api/quotes/:id', (req, res) => {
  try {
    const updated = db.updateQuote(req.params.id, req.body);
    if (!updated) {
      return res.status(404).json({ success: false, error: '해당 견적서를 찾을 수 없습니다.' });
    }
    res.json({ success: true, data: updated });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.delete('/api/quotes/:id', (req, res) => {
  try {
    const success = db.deleteQuote(req.params.id);
    res.json({ success });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ----------------------------------------------------
// 6. EXCEL EXPORT ENDPOINT
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
// 7. VITE MIDDLEWARE / STATIC ASSETS
// ----------------------------------------------------
async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`퀸 주방가구 견적/원가 자동화 서버 구동 완료: http://0.0.0.0:${PORT}`);
  });
}

startServer();
