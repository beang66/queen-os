import { describe, expect, it } from 'vitest';
import type { QuoteCalculationResult } from '../src/types.js';
import { validateQuoteForIssuance } from './quoteIssuance.js';

function fixture(): QuoteCalculationResult {
  return {
    breakdowns: [{ id: 'line-1', name: '하부장', sellingTotal: 110000, costTotal: 75000 }],
    summary: { totalSellingPrice: 110000, vatAmount: 11000, finalGrandTotal: 121000 },
    validationReport: [],
    appliedPricingSnapshot: { 'CAB-01': { id: 'catalog-1', code: 'CAB-01', costPrice: 75000, sellingPrice: 110000 } },
    calculatedAt: '2026-11-17T00:00:00.000Z',
  } as unknown as QuoteCalculationResult;
}

describe('서버 견적 발행 전 유효성 게이트', () => {
  it('동일 단가·명세의 정상이면 발행 허용 (계산 타임스탬프만 달라도 허용)', () => {
    const submitted = fixture();
    const canonical = fixture();
    canonical.calculatedAt = '2026-11-17T00:01:00.000Z';
    expect(validateQuoteForIssuance(submitted, canonical)).toEqual({ ok: true });
  });
  it('클라이언트가 최종 총액을 변조하면 거절', () => {
    const submitted = fixture();
    submitted.summary.finalGrandTotal = 1;
    expect(validateQuoteForIssuance(submitted, fixture()).ok).toBe(false);
  });
  it('품목별 금액 또는 수량 조작 거절', () => {
    const submitted = fixture();
    submitted.breakdowns[0].sellingTotal = 1;
    expect(validateQuoteForIssuance(submitted, fixture()).ok).toBe(false);
  });
  it('단가 스냅샷 조작 거절', () => {
    const submitted = fixture();
    submitted.appliedPricingSnapshot['CAB-01'].costPrice = 1;
    expect(validateQuoteForIssuance(submitted, fixture()).ok).toBe(false);
  });
  it('서버가 ERROR 를 발견하면 거절', () => {
    const canonical = fixture();
    canonical.validationReport.push({ type: 'ERROR', field: 'customerName', message: '고객명 누락' });
    expect(validateQuoteForIssuance(fixture(), canonical).ok).toBe(false);
  });
  it('전송된 자료에 ERROR 를 남긴 경우 거절', () => {
    const submitted = fixture();
    submitted.validationReport.push({ type: 'ERROR', field: 'lowerCabinetLengthMm', message: '규격 오류' });
    expect(validateQuoteForIssuance(submitted, fixture()).ok).toBe(false);
  });
  it('단가표 미등록으로 임시 기본값을 쓴 경우 거절', () => {
    const canonical = fixture();
    canonical.appliedPricingSnapshot['CAB-01'].id = 'temp-CAB-01';
    expect(validateQuoteForIssuance(fixture(), canonical).ok).toBe(false);
  });
  it('숨김 품목으로 견적 총액 불일치가 예상되면 거절', () => {
    expect(validateQuoteForIssuance(fixture(), fixture(), ['line-1']).ok).toBe(false);
  });
  it('비어 있는 견적 항목은 발행 금지', () => {
    const canonical = fixture();
    canonical.breakdowns = [];
    expect(validateQuoteForIssuance(fixture(), canonical).ok).toBe(false);
  });
});
