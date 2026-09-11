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
import * as XLSX from 'xlsx';

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
export function handleExportQuoteExcel(req: Request, res: Response) {
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
    res.status(500).json({ success: false, error: describeDbError(err) });
  }
}

router.post('/excel', handleExportQuoteExcel);

export default router;
