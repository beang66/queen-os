/**
 * 단가표 및 부자재 카탈로그 라우터 (Pricing API)
 * 
 * 엔드포인트:
 * - GET    /api/pricing             : 품목 목록 조회 (검색어, 카테고리 필터)
 * - GET    /api/pricing/fingerprint : 단가표 지문 조회 (초안 단가 변동 감지용)
 * - GET    /api/pricing/:id         : 단일 품목 상세 조회
 * - POST   /api/pricing             : 신규 단가 품목 추가
 * - PUT    /api/pricing/:id         : 기존 품목 정보 수정
 * - DELETE /api/pricing/:id         : 품목 삭제
 * - POST   /api/pricing/bulk        : 다중 품목 일괄 등록/갱신
 * - POST   /api/pricing/reset-seed  : 표준 카탈로그 초기화
 */
import { Router } from 'express';
import { db, describeDbError } from '../server/db.js';
import { parseBody } from '../server/validate.js';
import {
  PricingBulkSchema,
  PricingItemInputSchema,
  PricingItemUpdateSchema,
} from '../src/schemas.js';
import { hidesCost, stripPricingCost } from '../server/sanitize.js';

const router = Router();

// 품목 목록 검색 및 카테고리 필터링
router.get('/', async (req, res) => {
  try {
    const { search, category } = req.query;
    const items = await db.getPricingItems(search as string, category as string);
    const visible = hidesCost(req.user?.role) ? items.map(stripPricingCost) : items;
    res.json({ success: true, count: visible.length, data: visible });
  } catch (err: any) {
    res.status(500).json({ success: false, error: describeDbError(err) });
  }
});

// 단가표 지문 — 초안에 기록된 값과 비교해 "단가가 바뀌었는지" 판별한다.
// 주의: '/:id' 보다 먼저 선언해야 :id 로 잡히지 않는다.
router.get('/fingerprint', async (_req, res) => {
  try {
    res.json({ success: true, data: { fingerprint: await db.getPricingFingerprint() } });
  } catch (err: any) {
    res.status(500).json({ success: false, error: describeDbError(err) });
  }
});

// 단일 품목 상세 조회
router.get('/:id', async (req, res) => {
  try {
    const item = await db.getPricingItemById(req.params.id);
    if (!item) {
      return res.status(404).json({ success: false, error: '품목을 찾을 수 없습니다.' });
    }
    res.json({ success: true, data: hidesCost(req.user?.role) ? stripPricingCost(item) : item });
  } catch (err: any) {
    res.status(500).json({ success: false, error: describeDbError(err) });
  }
});

// 신규 품목 추가
router.post('/', async (req, res) => {
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
    res.status(500).json({ success: false, error: describeDbError(err) });
  }
});

// 품목 수정
router.put('/:id', async (req, res) => {
  try {
    const body = parseBody(PricingItemUpdateSchema, req, res);
    if (!body) return;

    const updated = await db.updatePricingItem(req.params.id, body);
    if (!updated) {
      return res.status(404).json({ success: false, error: '해당 품목을 찾을 수 없습니다.' });
    }
    res.json({ success: true, data: updated });
  } catch (err: any) {
    res.status(500).json({ success: false, error: describeDbError(err) });
  }
});

// 품목 삭제
router.delete('/:id', async (req, res) => {
  try {
    const success = await db.deletePricingItem(req.params.id);
    res.json({ success });
  } catch (err: any) {
    res.status(500).json({ success: false, error: describeDbError(err) });
  }
});

// 대량 품목 업서트
router.post('/bulk', async (req, res) => {
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
    res.status(500).json({ success: false, error: describeDbError(err) });
  }
});

// 표준 단가표 카탈로그 초기화
router.post('/reset-seed', async (_req, res) => {
  try {
    const items = await db.resetPricingCatalog();
    res.json({ success: true, message: '퀸 주방가구 표준 단가표 카탈로그로 초기화되었습니다.', count: items.length });
  } catch (err: any) {
    res.status(500).json({ success: false, error: describeDbError(err) });
  }
});

export default router;
