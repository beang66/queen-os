import { QuoteBreakdownItem, QuoteCalculationResult, ItemCategory } from '../../../types';

/** 원가 계산 단계에서 사용자가 조정하는 값 (결정론적 엔진 결과 위에 클라이언트에서 적용) */
export interface CostAdjustments {
  lossRatePct: number;      // 로스율 (%) — 재료비 카테고리에 가산
  targetMarginRate: number; // 목표 마진율 (%)
  discountAmount: number;   // 할인액 (원, 공급가에서 차감)
  surchargeAmount: number;  // 추가금 (원, 공급가에 가산)
  vatMode: 'EXCLUDED' | 'INCLUDED'; // 부가세 별도 / 포함
}

export const DEFAULT_ADJUSTMENTS: CostAdjustments = {
  lossRatePct: 3,
  targetMarginRate: 28,
  discountAmount: 0,
  surchargeAmount: 0,
  vatMode: 'EXCLUDED',
};

/** 재료비로 묶는 카테고리 (로스율 적용 대상) */
const MATERIAL_CATEGORIES: ItemCategory[] = ['CARCASS', 'DOOR', 'COUNTERTOP', 'ACCESSORY'];

const CATEGORY_LABEL: Record<ItemCategory, string> = {
  CARCASS: '몸통(캐비닛)',
  DOOR: '도어·마감재',
  COUNTERTOP: '상판',
  HARDWARE: '하드웨어',
  APPLIANCE: '기기·싱크·수전',
  LABOR: '시공·가공',
  ACCESSORY: '부자재',
};

/** LABOR breakdown 을 철거 / 운반·양중 / 시공·가공 으로 분류 */
export function classifyLabor(item: QuoteBreakdownItem): '철거' | '운반·양중' | '시공·가공' {
  if (item.id === 'bd-labor-demo') return '철거';
  if (item.id === 'bd-labor-ladder') return '운반·양중';
  return '시공·가공';
}

export interface CostGroup {
  key: string;
  label: string;
  cost: number;      // 원가 (로스율 적용 후)
  baseCost: number;  // 엔진 원가
  items: QuoteBreakdownItem[];
}

export interface ComputedCost {
  groups: CostGroup[];
  materialCost: number;      // 재료비 (로스 적용)
  hardwareCost: number;      // 하드웨어비
  applianceCost: number;     // 기기비
  laborCost: number;         // 외주·시공비 합계
  laborBreakdown: { 철거: number; '운반·양중': number; '시공·가공': number };
  lossAddOn: number;         // 로스율로 추가된 금액
  engineManufacturingCost: number; // 엔진 총 제조원가
  adjustedCost: number;      // 로스 반영 원가
  targetSellingPrice: number;// 목표 마진율 적용 공급가
  engineSellingPrice: number;// 엔진(단가표) 기준 공급가 참고값
  discountedSellingPrice: number; // 할인·추가금 반영 후 공급가
  vatAmount: number;
  finalTotal: number;        // 최종 견적 총액 (VAT 포함)
  effectiveMarginRate: number; // 실제 달성 마진율
  missingPriceItems: QuoteBreakdownItem[]; // 임시(누락) 단가로 계산된 항목
}

const round = (n: number) => Math.round(n);

export function computeCost(
  result: QuoteCalculationResult,
  adj: CostAdjustments
): ComputedCost {
  const breakdowns = result.breakdowns || [];
  const lossFactor = 1 + Math.max(0, adj.lossRatePct) / 100;

  // 카테고리별 그룹
  const byCat = new Map<string, QuoteBreakdownItem[]>();
  for (const b of breakdowns) {
    const arr = byCat.get(b.category) || [];
    arr.push(b);
    byCat.set(b.category, arr);
  }

  const groups: CostGroup[] = [];
  (Object.keys(CATEGORY_LABEL) as ItemCategory[]).forEach((cat) => {
    const items = byCat.get(cat);
    if (!items || items.length === 0) return;
    const baseCost = items.reduce((a, i) => a + i.costTotal, 0);
    const withLoss = MATERIAL_CATEGORIES.includes(cat) ? round(baseCost * lossFactor) : baseCost;
    groups.push({ key: cat, label: CATEGORY_LABEL[cat], cost: withLoss, baseCost, items });
  });

  const catCost = (cat: ItemCategory, loss: boolean) => {
    const items = byCat.get(cat) || [];
    const base = items.reduce((a, i) => a + i.costTotal, 0);
    return loss ? round(base * lossFactor) : base;
  };

  const materialCost =
    catCost('CARCASS', true) + catCost('DOOR', true) + catCost('COUNTERTOP', true) + catCost('ACCESSORY', true);
  const hardwareCost = catCost('HARDWARE', false);
  const applianceCost = catCost('APPLIANCE', false);

  const laborItems = byCat.get('LABOR') || [];
  const laborBreakdown = { 철거: 0, '운반·양중': 0, '시공·가공': 0 } as ComputedCost['laborBreakdown'];
  for (const it of laborItems) {
    laborBreakdown[classifyLabor(it)] += it.costTotal;
  }
  const laborCost = laborBreakdown['철거'] + laborBreakdown['운반·양중'] + laborBreakdown['시공·가공'];

  const engineManufacturingCost = result.summary?.totalManufacturingCost ?? breakdowns.reduce((a, i) => a + i.costTotal, 0);
  const adjustedCost = materialCost + hardwareCost + applianceCost + laborCost;
  const lossAddOn = adjustedCost - engineManufacturingCost;

  const m = Math.min(90, Math.max(0, adj.targetMarginRate)) / 100;
  const targetSellingPrice = m < 1 ? round(adjustedCost / (1 - m)) : adjustedCost;
  const engineSellingPrice = result.summary?.totalSellingPrice ?? 0;

  const discountedSellingPrice = Math.max(
    0,
    targetSellingPrice - Math.max(0, adj.discountAmount) + Math.max(0, adj.surchargeAmount)
  );

  let vatAmount: number;
  let finalTotal: number;
  if (adj.vatMode === 'INCLUDED') {
    // 공급가에 VAT 포함 → 공급가 자체가 최종, VAT는 내림 표시
    vatAmount = round(discountedSellingPrice - discountedSellingPrice / 1.1);
    finalTotal = discountedSellingPrice;
  } else {
    vatAmount = round(discountedSellingPrice * 0.1);
    finalTotal = discountedSellingPrice + vatAmount;
  }

  const netSupply = adj.vatMode === 'INCLUDED' ? discountedSellingPrice - vatAmount : discountedSellingPrice;
  const effectiveMarginRate = netSupply > 0 ? Number((((netSupply - adjustedCost) / netSupply) * 100).toFixed(1)) : 0;

  const missingPriceItems = breakdowns.filter(
    (b) => b.code?.startsWith('temp-') || /임시/.test(b.name)
  );

  return {
    groups,
    materialCost,
    hardwareCost,
    applianceCost,
    laborCost,
    laborBreakdown,
    lossAddOn,
    engineManufacturingCost,
    adjustedCost,
    targetSellingPrice,
    engineSellingPrice,
    discountedSellingPrice,
    vatAmount,
    finalTotal,
    effectiveMarginRate,
    missingPriceItems,
  };
}

export const won = (n: number) => `₩${Math.round(n || 0).toLocaleString()}`;

/** 적용 단가의 최신 기준일 (appliedPricingSnapshot 중 가장 늦은 updatedAt) */
export function pricingBaseDate(result: QuoteCalculationResult): string | null {
  const snap = result.appliedPricingSnapshot || {};
  const dates = Object.values(snap)
    .map((p) => p?.updatedAt)
    .filter(Boolean) as string[];
  if (dates.length === 0) return null;
  return dates.sort().slice(-1)[0].slice(0, 10);
}
