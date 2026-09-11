/**
 * 등급별 응답 정리 — 조회전용(VIEWER) 사용자에게 원가·마진이 나가지 않게 합니다.
 *
 * 화면에서 열을 감추는 것만으로는 부족합니다. 브라우저 개발자도구의 네트워크 탭이나
 * API 직접 호출로 응답 본문을 그대로 볼 수 있기 때문입니다. 그래서 값 자체를
 * 서버에서 0 으로 지웁니다.
 *
 * 왜 필드를 지우지 않고 0 으로 두는가:
 *   응답 스키마(QuoteBreakdownItem 등)가 이 필드들을 필수로 요구합니다. 필드를
 *   빼면 화면이 스키마 검증에서 실패합니다. 대신 프런트가 VIEWER 일 때 원가·마진
 *   열을 아예 렌더링하지 않으므로, 이 0 이 "0원"으로 잘못 보이는 일은 없습니다.
 *   (두 겹 모두 같은 role 값을 보고 동작합니다.)
 */
import { PricingItem, QuoteDocument, UserRole } from '../src/types.js';

export function hidesCost(role: UserRole | undefined): boolean {
  return role === 'VIEWER';
}

/** 견적서 1건에서 원가·마진 흔적을 지운다. 공급가(고객가)는 그대로 둔다. */
export function stripQuoteCost(quote: QuoteDocument): QuoteDocument {
  const calc = quote.calculationResult;
  if (!calc) return quote;

  return {
    ...quote,
    // 발행 시점 단가 스냅샷에는 매입원가가 들어 있으므로 통째로 제거한다.
    appliedPricingSnapshot: undefined,
    calculationResult: {
      ...calc,
      breakdowns: (calc.breakdowns ?? []).map((b) => ({
        ...b,
        costUnitPrice: 0,
        costTotal: 0,
        marginRate: 0,
      })),
      summary: {
        ...calc.summary,
        carcassCost: 0,
        doorCost: 0,
        countertopCost: 0,
        hardwareCost: 0,
        applianceCost: 0,
        laborCost: 0,
        accessoryCost: 0,
        totalManufacturingCost: 0,
        totalMarginAmount: 0,
        averageMarginRate: 0,
      },
      appliedPricingSnapshot: {},
    },
  };
}

/** 단가표에서 매입원가를 지운다. 출고단가는 견적 근거라 남긴다. */
export function stripPricingCost(item: PricingItem): PricingItem {
  return { ...item, costPrice: 0 };
}
