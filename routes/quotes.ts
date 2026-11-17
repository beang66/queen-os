/**
 * 견적서 계산, 관리 및 엑셀 다운로드 라우터 (Quotes API)
 * 
 * 엔드포인트:
 * - POST   /api/quote/calculate     : 공종별/자재별 원가 및 견적 자동 계산
 * - GET    /api/quotes              : 발행된 견적서 목록 조회
 * - GET    /api/quotes/:id          : 단일 견적서 상세 조회
 * - POST   /api/quotes              : 견적서 최종 발행 및 저장 (초안 연계)
 * - PUT    /api/quotes/:id          : 견적서 내용 수정
 * - DELETE /api/quotes/:id          : 견적서 삭제
 * - POST   /api/quotes/excel        : 견적서 엑셀(.xlsx) 파일 생성 및 다운로드
 */
import { Router, Request, Response } from 'express';
import { db, describeDbError } from '../server/db.js';
import { calculateDeterministicQuote } from '../server/calculationEngine.js';
import { parseBody } from '../server/validate.js';
import {
  CalculateQuoteSchema,
  SaveQuoteSchema,
  UpdateQuoteSchema,
} from '../src/schemas.js';
import { hidesCost, stripQuoteCost } from '../server/sanitize.js';
import { z } from 'zod';
import { validateQuoteForIssuance } from '../server/quoteIssuance.js';
import { createQuoteExcel } from '../server/quoteExcel.js';

const router = Router();

// ----------------------------------------------------
// 견적 원가 계산 엔진 연동
// ----------------------------------------------------
router.post('/calculate', async (req, res) => {
  try {
    const body = parseBody(CalculateQuoteSchema, req, res);
    if (!body) return;

    const calculationResult = await calculateDeterministicQuote(body.orderEntity);
    res.json({ success: true, data: calculationResult });
  } catch (err: any) {
    console.error('Calculation error:', err);
    res.status(500).json({ success: false, error: describeDbError(err) });
  }
});

// ----------------------------------------------------
// 견적서 CRUD
// ----------------------------------------------------

// 견적서 목록 조회
router.get('/', async (req, res) => {
  try {
    const { status, search } = req.query;
    const quotes = await db.getQuotes(status as string, search as string);
    const visible = hidesCost(req.user?.role) ? quotes.map(stripQuoteCost) : quotes;
    res.json({ success: true, count: visible.length, data: visible });
  } catch (err: any) {
    res.status(500).json({ success: false, error: describeDbError(err) });
  }
});

// 견적서 단건 상세 조회
router.get('/:id', async (req, res) => {
  try {
    const quote = await db.getQuoteById(req.params.id);
    if (!quote) {
      return res.status(404).json({ success: false, error: '견적서를 찾을 수 없습니다.' });
    }
    res.json({ success: true, data: hidesCost(req.user?.role) ? stripQuoteCost(quote) : quote });
  } catch (err: any) {
    res.status(500).json({ success: false, error: describeDbError(err) });
  }
});

// 견적서 저장 및 발행
router.post('/', async (req, res) => {
  try {
    const body = parseBody(SaveQuoteSchema, req, res);
    if (!body) return;

    const { orderEntity, draftId } = body;
    // Recompute from DB prices, and compare against what the reviewer saw.
    const canonicalCalculation = await calculateDeterministicQuote(orderEntity);
    const check = validateQuoteForIssuance(
      body.calculationResult, canonicalCalculation, body.publishMeta?.hiddenBreakdownIds,
    );
    if (!check.ok) return res.status(409).json({ success: false, error: check.reason });

    const saved = await db.saveQuote({
      title: body.title || `${orderEntity.customerName} 고객님 주방가구 맞춤 견적서`,
      status: body.status || 'ISSUED',
      targetMarginRate: body.targetMarginRate ?? 28,
      version: body.version ?? 1,
      parentQuoteId: body.parentQuoteId || undefined,
      publishMeta: body.publishMeta || undefined,
      quoteNumber: body.quoteNumber || undefined,
      orderEntity,
      calculationResult: canonicalCalculation,
      notes: body.notes || '',
      companyInfo: {
        name: '퀸 주방가구 (Queen Kitchen)',
        representative: '김대표',
        bizNumber: '123-45-67890',
        address: '경기도 남양주시 화도읍 예시로 88',
        phone: '031-000-0000 / 010-0000-0000',
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
    res.status(500).json({ success: false, error: describeDbError(err) });
  }
});

// 견적서 수정
router.put('/:id', async (req, res) => {
  try {
    const body = parseBody(UpdateQuoteSchema, req, res);
    if (!body) return;

    const updated = await db.updateQuote(req.params.id, body);
    if (!updated) {
      return res.status(404).json({ success: false, error: '해당 견적서를 찾을 수 없습니다.' });
    }
    res.json({ success: true, data: updated });
  } catch (err: any) {
    res.status(500).json({ success: false, error: describeDbError(err) });
  }
});

// 견적서 삭제
router.delete('/:id', async (req, res) => {
  try {
    const success = await db.deleteQuote(req.params.id);
    res.json({ success });
  } catch (err: any) {
    res.status(500).json({ success: false, error: describeDbError(err) });
  }
});

// ----------------------------------------------------
// 엑셀 내보내기 핸들러
// ----------------------------------------------------
const ExportQuoteRequestSchema = z.object({
  quoteId: z.string().min(1),
  audience: z.enum(['customer', 'internal']).default('customer'),
}).strict();

/** Both /api/quotes/excel and legacy /api/export/quote-excel use this secure handler. */
export async function handleExportQuoteExcel(req: Request, res: Response) {
  try {
    const body = parseBody(ExportQuoteRequestSchema, req, res);
    if (!body) return;
    if (body.audience === 'internal' && !['ADMIN', 'ESTIMATOR'].includes(req.user?.role ?? '')) {
      return res.status(403).json({ success: false, error: '내부용 원가·마진 자료에 접근할 권한이 없습니다.' });
    }
    const quote = await db.getQuoteById(body.quoteId);
    if (!quote) return res.status(404).json({ success: false, error: '발행된 견적서를 찾을 수 없습니다.' });
    const buffer = createQuoteExcel(quote, body.audience);
    const safeNo = quote.quoteNumber.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 60);
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Content-Disposition', `attachment; filename="queen_quote_${safeNo}_${body.audience}.xlsx"`);
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.send(buffer);
  } catch (err: any) {
    console.error('Excel export error:', err);
    res.status(500).json({ success: false, error: describeDbError(err) });
  }
}

router.post('/excel', handleExportQuoteExcel);

export default router;
