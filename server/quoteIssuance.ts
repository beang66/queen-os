/**
 * This gate prevents tampered/stale client calculations from being persisted as issued quotes.
 * The canonical calculation is produced again by the server with the current pricing catalog.
 */
import type { QuoteCalculationResult } from '../src/types.js';

export type IssueCheck = { ok: true } | { ok: false; reason: string };

export function validateQuoteForIssuance(
  submitted: QuoteCalculationResult,
  canonical: QuoteCalculationResult,
  hiddenBreakdownIds: string[] = [],
): IssueCheck {
  const reject = (reason: string): IssueCheck => ({ ok: false, reason });
  const uniqueExcluded = new Set(hiddenBreakdownIds);
  if (uniqueExcluded.size !== hiddenBreakdownIds.length || hiddenBreakdownIds.some(id => !canonical.breakdowns.some(b=>b.id===id))) {
    return reject('제외할 품목에 중복되거나 존재하지 않는 ID가 있습니다.');
  }
  if (canonical.breakdowns.length && uniqueExcluded.size === canonical.breakdowns.length) {
    return reject('모든 품목을 제외한 견적은 발행할 수 없습니다.');
  }
  if (!canonical.breakdowns.length) return reject('견적 항목이 없어서 발행할 수 없습니다.');
  if (canonical.validationReport.some(item => item.type === 'ERROR')) {
    return reject('주문 정보에 오류가 있습니다. 규격 검수 후 다시 계산해 주세요.');
  }
  if (Object.values(canonical.appliedPricingSnapshot).some(item => item.id.startsWith('temp-'))) {
    return reject('단가표에 없는 품목의 임시 가격이 포함되어 있습니다. 단가를 등록한 후 다시 계산해 주세요.');
  }
  if (submitted.validationReport.some(item => item.type === 'ERROR')) {
    return reject('전송된 견적에 검수 오류가 있습니다. 다시 계산해 주세요.');
  }
  // calculatedAt is a timestamp; compare all price-bearing fields instead.
  if (
    JSON.stringify(submitted.breakdowns) !== JSON.stringify(canonical.breakdowns)
    || JSON.stringify(submitted.summary) !== JSON.stringify(canonical.summary)
    || JSON.stringify(submitted.appliedPricingSnapshot) !== JSON.stringify(canonical.appliedPricingSnapshot)
  ) {
    return reject('견적 금액 또는 적용 단가가 최신 서버 계산 결과와 다릅니다. 다시 계산한 뒤 발행해 주세요.');
  }
  return { ok: true };
}
