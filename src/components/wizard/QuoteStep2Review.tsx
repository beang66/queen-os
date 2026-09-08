import React, { useMemo } from 'react';
import { CheckCircle2, AlertTriangle, Info, Loader2, Save, ArrowLeft, ArrowRight } from 'lucide-react';
import { OrderEntity, PricingItem, ReviewLineItem } from '../../types';
import { CustomerSiteInfo } from './review/CustomerSiteInfo';
import { KitchenItemsTable } from './review/KitchenItemsTable';
import { DetailOptionsPanel } from './review/DetailOptionsPanel';
import { getRequiredFields } from './review/reviewModel';

/** 저장 시각을 HH:MM 으로 */
const savedTimeLabel = (iso: string) => {
  const d = new Date(iso);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
};

interface QuoteStep2ReviewProps {
  orderEntity: OrderEntity;
  setOrderEntity: React.Dispatch<React.SetStateAction<OrderEntity>>;
  items: ReviewLineItem[];
  setItems: React.Dispatch<React.SetStateAction<ReviewLineItem[]>>;
  pricingItems: PricingItem[];
  promptText: string;
  /** 견적 초안을 서버에 즉시 저장 */
  onTempSave: () => void;
  tempSaving: boolean;
  lastSavedAt: string | null;
  onPrevStep: () => void;
  onNextStep: () => void;
}

/**
 * 견적 마법사 2단계: 규격 검수
 * 1단계에서 확정한 정보를 원문과 대조하며 정밀 검토하고, 누락·미연결 항목을 해소합니다.
 */
export const QuoteStep2Review: React.FC<QuoteStep2ReviewProps> = ({
  orderEntity,
  setOrderEntity,
  items,
  setItems,
  pricingItems,
  promptText,
  onTempSave,
  tempSaving,
  lastSavedAt,
  onPrevStep,
  onNextStep,
}) => {

  const requiredFields = useMemo(() => getRequiredFields(orderEntity), [orderEntity]);
  const filledCount = requiredFields.filter((f) => f.ok).length;
  const missingCount = requiredFields.length - filledCount;
  const unlinkedItems = items.filter((i) => i.status === 'NEEDS_PRICING');
  const unlinkedCount = unlinkedItems.length;
  const canProceed = missingCount === 0 && unlinkedCount === 0;

  // 다음 단계 버튼이 잠긴 구체적인 사유
  const missingNames = requiredFields.filter((f) => !f.ok).map((f) => f.key);
  const unlinkedNames = unlinkedItems.map((i) => i.name?.trim() || '(품목명 미입력)');

  return (
    <div className="space-y-4">
      {/* 상단 상태 바 */}
      <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-xs flex flex-col lg:flex-row lg:items-center gap-3 justify-between">
        <div className="flex items-center gap-2 min-w-0">
          <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
          <h2 className="text-sm font-bold text-gray-800">규격 검수</h2>
          <p className="text-[11px] text-gray-500 truncate hidden sm:block">
            품목·규격·수량을 확정하고 단가 DB와 연결하세요.
          </p>
        </div>

        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-semibold text-gray-500">필수 정보</span>
            <div className="w-28 h-1.5 rounded-full bg-gray-100 overflow-hidden">
              <div
                className={`h-full rounded-full transition-all ${missingCount === 0 ? 'bg-emerald-500' : 'bg-blue-500'}`}
                style={{ width: `${(filledCount / requiredFields.length) * 100}%` }}
              />
            </div>
            <span className="text-[11px] font-mono font-bold text-gray-700">
              {filledCount}/{requiredFields.length}
            </span>
          </div>

          {missingCount > 0 && (
            <span className="flex items-center gap-1 text-[11px] font-bold text-orange-700 bg-orange-50 border border-orange-200 px-2 py-1 rounded-lg">
              <AlertTriangle className="w-3 h-3" />
              확인 필요 {missingCount}건
            </span>
          )}

          <button
            type="button"
            onClick={onTempSave}
            disabled={tempSaving}
            className="flex items-center gap-1 text-[11px] font-semibold text-gray-500 hover:text-gray-700 disabled:opacity-50"
          >
            {tempSaving ? (
              <span className="flex items-center gap-1 text-blue-600">
                <Loader2 className="w-3.5 h-3.5 animate-spin" /> 저장 중...
              </span>
            ) : lastSavedAt ? (
              <span className="flex items-center gap-1 text-emerald-600">
                <CheckCircle2 className="w-3.5 h-3.5" /> 견적 관리에 저장됨 {savedTimeLabel(lastSavedAt)}
              </span>
            ) : (
              <>
                <Save className="w-3.5 h-3.5" /> 임시 저장
              </>
            )}
          </button>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-xs space-y-4">
        <CustomerSiteInfo orderEntity={orderEntity} setOrderEntity={setOrderEntity} />

        {/* AI 추출값과 원문 출처 비교 */}
        {promptText?.trim() && (
          <details className="border border-gray-200 rounded-xl bg-slate-50/50 text-xs">
            <summary className="cursor-pointer select-none px-3 py-2.5 font-semibold text-gray-600 flex items-center gap-1.5">
              <Info className="w-3.5 h-3.5 text-blue-500" />
              AI 추출값과 원문(상담 메모) 출처 비교
            </summary>
            <pre className="px-3 pb-3 pt-1 whitespace-pre-wrap font-mono text-[11px] leading-relaxed text-gray-600 max-h-52 overflow-y-auto">
              {promptText}
            </pre>
          </details>
        )}

        <KitchenItemsTable items={items} setItems={setItems} pricingItems={pricingItems} />
        <DetailOptionsPanel orderEntity={orderEntity} setOrderEntity={setOrderEntity} />
      </div>

      {/* 하단: 누락/오류 검사 + 완료 버튼 */}
      <div className="bg-white rounded-xl border border-gray-200 p-3 shadow-xs flex flex-col sm:flex-row items-center justify-between gap-3">
        <button
          type="button"
          onClick={onPrevStep}
          className="w-full sm:w-auto border border-gray-300 hover:bg-gray-50 text-gray-700 font-semibold px-4 py-2.5 rounded-lg text-xs flex items-center justify-center gap-1.5 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          1단계: 자료 입력으로
        </button>

        {!canProceed && (
          <div className="flex-1 min-w-0 flex items-start gap-1.5 text-[11px] text-orange-700 bg-orange-50 border border-orange-200 rounded-lg px-3 py-2">
            <AlertTriangle className="w-4 h-4 shrink-0 mt-px" />
            <div className="space-y-0.5 min-w-0">
              <p className="font-bold">아래 항목을 해결하면 원가 계산으로 이동할 수 있습니다.</p>
              {missingNames.length > 0 && (
                <p>
                  <span className="font-semibold">확인 필요 {missingNames.length}건</span>
                  <span className="text-orange-600/90"> — {missingNames.join(', ')}</span>
                </p>
              )}
              {unlinkedNames.length > 0 && (
                <p>
                  <span className="font-semibold">미연결 단가 {unlinkedNames.length}건</span>
                  <span className="text-orange-600/90"> — {unlinkedNames.join(', ')}</span>
                  <span className="text-orange-600/70"> (품목 상태 뱃지를 눌러 단가 DB와 연결하세요)</span>
                </p>
              )}
            </div>
          </div>
        )}

        <button
          type="button"
          disabled={!canProceed}
          onClick={onNextStep}
          className="w-full sm:w-auto bg-blue-600 hover:bg-blue-700 disabled:bg-gray-200 disabled:text-gray-400 disabled:cursor-not-allowed text-white font-bold px-5 py-2.5 rounded-lg shadow-xs text-xs flex items-center justify-center gap-2 transition-colors"
        >
          규격 검수 완료 및 다음 단계
          <ArrowRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};
