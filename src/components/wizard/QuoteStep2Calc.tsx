import React from 'react';
import {
  DollarSign,
  RefreshCw,
  ArrowLeft,
  ArrowRight,
  Info,
} from 'lucide-react';
import { QuoteCalculationResult, OrderEntity } from '../../types';

interface QuoteStep2CalcProps {
  orderEntity: OrderEntity;
  targetMarginRate: number;
  setTargetMarginRate: (margin: number) => void;
  calculationResult: QuoteCalculationResult | null;
  calcLoading: boolean;
  onCalculate: () => void;
  onPrevStep: () => void;
  onNextStep: () => void;
}

/**
 * 견적 마법사 Step 2: 실시간 원가 산출 엔진 & 마진율 조절 컴포넌트
 */
export const QuoteStep2Calc: React.FC<QuoteStep2CalcProps> = ({
  orderEntity,
  targetMarginRate,
  setTargetMarginRate,
  calculationResult,
  calcLoading,
  onCalculate,
  onPrevStep,
  onNextStep,
}) => {
  return (
    <div className="space-y-6">
      {/* 마진율 조절 컨트롤러 패널 */}
      <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-gray-100 pb-3">
          <div>
            <h3 className="text-sm font-bold text-gray-800 flex items-center gap-2">
              <DollarSign className="w-4 h-4 text-emerald-600" />
              목표 마진율 (Target Margin Rate) 설정
            </h3>
            <p className="text-xs text-gray-500 mt-0.5">
              원가 산출 공식에 따라 실시간으로 영업 견적가 및 이익금이 계산됩니다.
            </p>
          </div>
          <button
            type="button"
            onClick={onCalculate}
            disabled={calcLoading}
            className="bg-gray-900 hover:bg-gray-800 text-white font-medium text-xs px-3.5 py-2 rounded-lg flex items-center justify-center gap-1.5 transition-colors self-start sm:self-auto"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${calcLoading ? 'animate-spin' : ''}`} />
            <span>원가 재계산 실행</span>
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-center pt-1">
          <div className="md:col-span-2 space-y-2">
            <div className="flex justify-between items-center text-xs">
              <span className="font-semibold text-gray-700">마진율 조절 슬라이더</span>
              <span className="font-mono font-bold text-blue-600 text-sm">{targetMarginRate}%</span>
            </div>
            <input
              type="range"
              min={10}
              max={50}
              step={1}
              value={targetMarginRate}
              onChange={(e) => setTargetMarginRate(Number(e.target.value))}
              className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
            />
            <div className="flex justify-between text-[11px] text-gray-400 font-mono">
              <span>10% (최저 원가)</span>
              <span>28% (권장 표준)</span>
              <span>50% (프리미엄)</span>
            </div>
          </div>

          <div className="bg-slate-50 p-3.5 rounded-lg border border-slate-200 space-y-1">
            <div className="text-[11px] text-slate-500 font-medium">선택된 고객 & 레이아웃</div>
            <div className="text-xs font-bold text-slate-800">
              {orderEntity.customerName} ({orderEntity.layoutType})
            </div>
            <div className="text-[11px] text-slate-600 font-mono">
              하부장 {orderEntity.dimensions.lowerCabinetLengthMm}mm | 상부장{' '}
              {orderEntity.dimensions.upperCabinetLengthMm}mm
            </div>
          </div>
        </div>
      </div>

      {/* 원가 산출 결과 카드 요약 */}
      {calculationResult ? (
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {/* 총 원가 Card */}
            <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-xs">
              <div className="text-xs text-gray-500 font-medium">총 제조 & 시공 원가</div>
              <div className="text-xl font-mono font-bold text-gray-900 mt-1">
                ₩{(calculationResult.summary.totalManufacturingCost || 0).toLocaleString()}
              </div>
              <div className="text-[11px] text-gray-400 mt-1">자재/도어/상판/공임/시공 포함</div>
            </div>

            {/* 마진 금액 Card */}
            <div className="bg-white rounded-xl border border-emerald-200 bg-emerald-50/30 p-4 shadow-xs">
              <div className="text-xs text-emerald-700 font-medium">예상 영업 마진액 ({targetMarginRate}%)</div>
              <div className="text-xl font-mono font-bold text-emerald-600 mt-1">
                ₩{(calculationResult.summary.totalMarginAmount || 0).toLocaleString()}
              </div>
              <div className="text-[11px] text-emerald-600/70 mt-1">순수 영업 및 기업 이익금</div>
            </div>

            {/* 최종 견적가 Card */}
            <div className="bg-gradient-to-br from-blue-900 to-indigo-900 text-white rounded-xl p-4 shadow-md">
              <div className="text-xs text-blue-200 font-medium">최종 공급 견적가 (VAT 별도)</div>
              <div className="text-2xl font-mono font-extrabold text-white mt-1">
                ₩{(calculationResult.summary.totalSellingPrice || 0).toLocaleString()}
              </div>
              <div className="text-[11px] text-blue-300/80 mt-1">
                VAT 포함: ₩{(calculationResult.summary.finalGrandTotal || 0).toLocaleString()}
              </div>
            </div>
          </div>

          {/* 원가 내역 상세 세부 항목 테이블 */}
          <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm space-y-3">
            <h4 className="text-xs font-bold text-gray-800 flex items-center justify-between border-b border-gray-100 pb-2">
              <span>원가 산출 세부 구성 항목 (Deterministic Breakdown)</span>
              <span className="text-[11px] text-gray-400 font-normal">
                총 {(calculationResult.breakdowns || []).length}개 산출 항목
              </span>
            </h4>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-200 text-gray-600 font-medium">
                    <th className="py-2 px-3">카테고리</th>
                    <th className="py-2 px-3">품목명 / 구분</th>
                    <th className="py-2 px-3 text-right">수량/규격</th>
                    <th className="py-2 px-3 text-right">단가 (원가)</th>
                    <th className="py-2 px-3 text-right">총 원가</th>
                    <th className="py-2 px-3 text-right">견적가</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {(calculationResult.breakdowns || []).map((item, idx) => (
                    <tr key={idx} className="hover:bg-gray-50/80 transition-colors">
                      <td className="py-2.5 px-3 font-medium text-gray-700">{item.category}</td>
                      <td className="py-2.5 px-3 text-gray-900 font-medium">{item.name}</td>
                      <td className="py-2.5 px-3 text-right font-mono text-gray-600">
                        {item.quantity} {item.unit}
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono text-gray-600">
                        ₩{(item.costUnitPrice || 0).toLocaleString()}
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono font-semibold text-gray-800">
                        ₩{(item.costTotal || 0).toLocaleString()}
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono font-bold text-blue-600">
                        ₩{(item.sellingTotal || 0).toLocaleString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 p-8 text-center space-y-3">
          <Info className="w-8 h-8 text-blue-500 mx-auto animate-pulse" />
          <p className="text-xs text-gray-600 font-medium">
            원가 산출 정보를 계산하는 중이거나 아직 실행되지 않았습니다.
          </p>
          <button
            type="button"
            onClick={onCalculate}
            className="bg-blue-600 text-white font-medium text-xs px-4 py-2 rounded-lg"
          >
            원가 계산 실행
          </button>
        </div>
      )}

      {/* 네비게이션 버튼 */}
      <div className="flex justify-between pt-2">
        <button
          type="button"
          onClick={onPrevStep}
          className="border border-gray-300 hover:bg-gray-100 text-gray-700 font-semibold px-4 py-2.5 rounded-lg text-xs flex items-center gap-1.5 transition-all"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>1단계: 규격 수정으로 이동</span>
        </button>

        <button
          type="button"
          onClick={onNextStep}
          disabled={!calculationResult}
          className="bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 text-white font-semibold px-6 py-2.5 rounded-lg shadow-sm text-xs flex items-center gap-2 transition-all"
        >
          <span>3단계: 최종 견적서 양식 보기 및 저장</span>
          <ArrowRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};
