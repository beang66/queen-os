import React, { useMemo, useState } from 'react';
import {
  Calculator,
  RefreshCw,
  ArrowLeft,
  ArrowRight,
  Info,
  AlertTriangle,
  AlertOctagon,
  ChevronDown,
  Percent,
  ReceiptText,
} from 'lucide-react';
import { QuoteCalculationResult, OrderEntity } from '../../types';
import {
  CostAdjustments,
  DEFAULT_ADJUSTMENTS,
  computeCost,
  pricingBaseDate,
  classifyLabor,
  won,
} from './calc/costModel';

interface QuoteStep2CalcProps {
  orderEntity: OrderEntity;
  targetMarginRate: number;
  setTargetMarginRate: (margin: number) => void;
  calculationResult: QuoteCalculationResult | null;
  calcLoading: boolean;
  calcDirty?: boolean;
  onCalculate: () => void;
  onPrevStep: () => void;
  onNextStep: () => void;
}

/**
 * 견적 마법사 3단계: 원가 계산
 * 결정론적 엔진 결과를 기준으로 로스율·목표 마진율·할인/추가금·부가세를 적용해
 * 최종 공급가를 산출하고, 계산 오류·누락 단가를 확인합니다.
 */
export const QuoteStep2Calc: React.FC<QuoteStep2CalcProps> = ({
  orderEntity,
  targetMarginRate,
  setTargetMarginRate,
  calculationResult,
  calcLoading,
  calcDirty = false,
  onCalculate,
  onPrevStep,
  onNextStep,
}) => {
  const [adj, setAdj] = useState<Omit<CostAdjustments, 'targetMarginRate'>>({
    lossRatePct: DEFAULT_ADJUSTMENTS.lossRatePct,
    discountAmount: 0,
    surchargeAmount: 0,
    vatMode: 'EXCLUDED',
  });
  const [openGroup, setOpenGroup] = useState<string | null>(null);

  const full: CostAdjustments = { ...adj, targetMarginRate };

  const computed = useMemo(
    () => (calculationResult ? computeCost(calculationResult, full) : null),
    [calculationResult, adj, targetMarginRate]
  );

  const baseDate = calculationResult ? pricingBaseDate(calculationResult) : null;
  const errors = (calculationResult?.validationReport || []).filter((v) => v.type === 'ERROR');
  const warnings = (calculationResult?.validationReport || []).filter((v) => v.type === 'WARNING');
  const infos = (calculationResult?.validationReport || []).filter((v) => v.type === 'INFO');

  const numField =
    'w-full text-right rounded-lg border border-gray-200 bg-white px-2.5 py-1.5 text-xs font-mono font-semibold text-gray-800 focus:border-blue-500 focus:outline-none';

  // ── 계산 전 ───────────────────────────────
  if (!calculationResult) {
    return (
      <div className="bg-white rounded-xl border border-gray-200 p-10 text-center space-y-3 shadow-xs">
        <Calculator className="w-9 h-9 text-blue-500 mx-auto" />
        <p className="text-sm font-bold text-gray-800">원가 계산이 아직 실행되지 않았습니다.</p>
        <p className="text-[11px] text-gray-500">규격 검수에서 확정한 품목과 단가표 DB를 기준으로 원가를 산출합니다.</p>
        <button
          type="button"
          onClick={onCalculate}
          disabled={calcLoading}
          className="mt-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white font-bold text-xs px-5 py-2.5 rounded-lg inline-flex items-center gap-2"
        >
          <RefreshCw className={`w-4 h-4 ${calcLoading ? 'animate-spin' : ''}`} />
          원가 계산 실행
        </button>
      </div>
    );
  }

  if (!computed) return null;

  return (
    <div className="space-y-4">
      {/* 상단: 제목 + 재계산 */}
      <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-start gap-2">
          <Calculator className="w-5 h-5 text-blue-500 mt-0.5" />
          <div>
            <h2 className="text-sm font-bold text-gray-800">원가 계산</h2>
            <p className="text-[11px] text-gray-500 mt-0.5">
              {orderEntity.customerName} · 적용 단가 기준일{' '}
              <span className="font-mono font-semibold text-gray-700">{baseDate ?? '—'}</span>
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={onCalculate}
          disabled={calcLoading}
          className={`shrink-0 inline-flex items-center gap-1.5 rounded-lg px-3.5 py-2 text-xs font-bold transition-colors ${
            calcDirty
              ? 'bg-orange-500 hover:bg-orange-600 text-white'
              : 'bg-gray-900 hover:bg-gray-800 text-white'
          }`}
        >
          <RefreshCw className={`w-3.5 h-3.5 ${calcLoading ? 'animate-spin' : ''}`} />
          {calcDirty ? '변경사항 반영하여 다시 계산' : '원가 재계산 실행'}
        </button>
      </div>

      {calcDirty && (
        <div className="flex items-center gap-2 rounded-lg border border-orange-200 bg-orange-50 px-3 py-2 text-[11px] font-semibold text-orange-700">
          <AlertTriangle className="w-3.5 h-3.5" />
          규격 검수 정보가 변경되었습니다. '변경사항 반영하여 다시 계산'을 눌러 최신 원가로 갱신하세요.
        </div>
      )}

      {/* 계산 오류 및 누락 단가 확인 */}
      {(errors.length > 0 || warnings.length > 0 || computed.missingPriceItems.length > 0) && (
        <div className="bg-white rounded-xl border border-gray-200 shadow-xs divide-y divide-gray-100">
          <div className="px-4 py-2.5 flex items-center gap-1.5 text-xs font-bold text-gray-800">
            <AlertOctagon className="w-4 h-4 text-orange-500" />
            계산 오류 및 누락 단가 확인
          </div>
          <ul className="p-3 space-y-1.5">
            {errors.map((v, i) => (
              <li key={`e${i}`} className="flex items-start gap-2 text-[11px] text-red-700 bg-red-50 border border-red-200 rounded-lg px-2.5 py-1.5">
                <AlertOctagon className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                <span><b>[오류] {v.field}</b> — {v.message}{v.suggestion ? ` (${v.suggestion})` : ''}</span>
              </li>
            ))}
            {computed.missingPriceItems.map((it) => (
              <li key={it.id} className="flex items-start gap-2 text-[11px] text-orange-800 bg-orange-50 border border-orange-200 rounded-lg px-2.5 py-1.5">
                <AlertTriangle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                <span><b>[누락 단가]</b> {it.name} — 단가표에 등록된 단가가 없어 임시 기본값으로 계산됨. 단가 DB에서 등록 후 재계산하세요.</span>
              </li>
            ))}
            {warnings.map((v, i) => (
              <li key={`w${i}`} className="flex items-start gap-2 text-[11px] text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-2.5 py-1.5">
                <AlertTriangle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                <span><b>[검토] {v.field}</b> — {v.message}</span>
              </li>
            ))}
            {infos.map((v, i) => (
              <li key={`i${i}`} className="flex items-start gap-2 text-[11px] text-blue-800 bg-blue-50 border border-blue-200 rounded-lg px-2.5 py-1.5">
                <Info className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                <span>{v.message}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start">
        {/* ── 좌: 원가 구성 ─────────────────── */}
        <div className="lg:col-span-7 space-y-4">
          {/* 비목별 원가 */}
          <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-xs space-y-3">
            <h3 className="text-xs font-bold text-gray-800">비목별 원가</h3>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {[
                { label: '재료비', v: computed.materialCost, note: `로스율 ${adj.lossRatePct}% 포함` },
                { label: '하드웨어비', v: computed.hardwareCost, note: '경첩·서랍·인출' },
                { label: '기기비', v: computed.applianceCost, note: '싱크·수전·후드·쿡탑' },
                { label: '외주·시공비', v: computed.laborCost, note: '철거·운반·시공' },
              ].map((c) => (
                <div key={c.label} className="rounded-lg border border-gray-100 bg-slate-50/60 p-2.5">
                  <div className="text-[10px] text-gray-500 font-medium">{c.label}</div>
                  <div className="text-sm font-mono font-bold text-gray-900 mt-0.5">{won(c.v)}</div>
                  <div className="text-[10px] text-gray-400 mt-0.5">{c.note}</div>
                </div>
              ))}
            </div>

            {/* 철거·운반·시공비 세부 */}
            <div className="rounded-lg border border-gray-100 bg-white p-2.5">
              <div className="text-[11px] font-semibold text-gray-600 mb-1.5">철거 · 운반 · 시공비 세부</div>
              <div className="grid grid-cols-3 gap-2 text-center">
                {(['철거', '운반·양중', '시공·가공'] as const).map((k) => (
                  <div key={k} className="rounded-md bg-slate-50 py-1.5">
                    <div className="text-[10px] text-gray-500">{k}</div>
                    <div className="text-xs font-mono font-bold text-gray-800">{won(computed.laborBreakdown[k])}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* 품목별 산출 근거 */}
          <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-xs space-y-2">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold text-gray-800">품목별 산출 근거</h3>
              <span className="text-[11px] text-gray-400">
                총 {(calculationResult.breakdowns || []).length}개 항목 · 적용 단가 / 단가 기준일 표시
              </span>
            </div>

            <div className="space-y-1.5">
              {computed.groups.map((g) => {
                const open = openGroup === g.key;
                return (
                  <div key={g.key} className="border border-gray-100 rounded-lg overflow-hidden">
                    <button
                      type="button"
                      onClick={() => setOpenGroup(open ? null : g.key)}
                      className="w-full flex items-center justify-between px-3 py-2 bg-slate-50/70 hover:bg-slate-100/70 text-xs"
                    >
                      <span className="flex items-center gap-1.5 font-bold text-gray-700">
                        <ChevronDown className={`w-3.5 h-3.5 text-gray-400 transition-transform ${open ? 'rotate-180' : ''}`} />
                        {g.label}
                        <span className="text-[10px] font-normal text-gray-400">({g.items.length})</span>
                      </span>
                      <span className="font-mono font-semibold text-gray-700">{won(g.cost)}</span>
                    </button>

                    {open && (
                      <div className="overflow-x-auto">
                        <table className="w-full text-left text-[11px] border-collapse min-w-[560px]">
                          <thead>
                            <tr className="text-gray-500 border-b border-gray-100 bg-white">
                              <th className="py-1.5 px-2 font-semibold">품목 / 산출 근거</th>
                              <th className="py-1.5 px-2 font-semibold text-right w-20">수량·단위</th>
                              <th className="py-1.5 px-2 font-semibold text-right w-24">적용 단가</th>
                              <th className="py-1.5 px-2 font-semibold text-right w-24">원가</th>
                              <th className="py-1.5 px-2 font-semibold text-right w-16">마진%</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-gray-50">
                            {g.items.map((it) => (
                              <tr key={it.id} className="align-top">
                                <td className="py-1.5 px-2">
                                  <div className="font-semibold text-gray-800">{it.name}</div>
                                  <div className="text-[10px] text-gray-400 font-mono">{it.formula}</div>
                                  {g.key === 'LABOR' && (
                                    <span className="inline-block mt-0.5 text-[9px] font-bold text-sky-700 bg-sky-50 border border-sky-200 rounded px-1">
                                      {classifyLabor(it)}
                                    </span>
                                  )}
                                </td>
                                <td className="py-1.5 px-2 text-right font-mono text-gray-600">
                                  {it.quantity} {it.unit}
                                </td>
                                <td className="py-1.5 px-2 text-right font-mono text-gray-600">
                                  {won(it.costUnitPrice)}
                                  <div className="text-[9px] text-gray-400">/{it.unit}</div>
                                </td>
                                <td className="py-1.5 px-2 text-right font-mono font-semibold text-gray-800">{won(it.costTotal)}</td>
                                <td className="py-1.5 px-2 text-right font-mono text-gray-500">{it.marginRate}%</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* ── 우: 가격 조정 & 최종 산출 ─────────────────── */}
        <div className="lg:col-span-5 space-y-4">
          {/* 조정 컨트롤 */}
          <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-xs space-y-3.5">
            <h3 className="text-xs font-bold text-gray-800 flex items-center gap-1.5">
              <Percent className="w-4 h-4 text-emerald-600" />
              가격 조정
            </h3>

            {/* 로스율 */}
            <label className="block">
              <span className="text-[11px] font-medium text-gray-500">로스율 (재료비 가산)</span>
              <div className="flex items-center gap-2 mt-1">
                <input
                  type="range" min={0} max={15} step={0.5}
                  value={adj.lossRatePct}
                  onChange={(e) => setAdj({ ...adj, lossRatePct: Number(e.target.value) })}
                  className="flex-1 h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
                />
                <span className="w-14 text-right font-mono font-bold text-blue-600 text-xs">{adj.lossRatePct}%</span>
              </div>
            </label>

            {/* 목표 마진율 */}
            <label className="block">
              <span className="text-[11px] font-medium text-gray-500">목표 마진율</span>
              <div className="flex items-center gap-2 mt-1">
                <input
                  type="range" min={0} max={50} step={1}
                  value={targetMarginRate}
                  onChange={(e) => setTargetMarginRate(Number(e.target.value))}
                  className="flex-1 h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-emerald-600"
                />
                <span className="w-14 text-right font-mono font-bold text-emerald-600 text-xs">{targetMarginRate}%</span>
              </div>
              <span className="text-[10px] text-gray-400">
                실제 달성 마진율 <b className="text-gray-600">{computed.effectiveMarginRate}%</b> · 단가표 기준 공급가 {won(computed.engineSellingPrice)}
              </span>
            </label>

            {/* 할인 / 추가금 */}
            <div className="grid grid-cols-2 gap-2">
              <label className="block">
                <span className="text-[11px] font-medium text-gray-500">할인액 (−)</span>
                <input
                  type="number" min={0} step={10000}
                  value={adj.discountAmount}
                  onChange={(e) => setAdj({ ...adj, discountAmount: Math.max(0, Number(e.target.value)) })}
                  className={`${numField} mt-1`}
                />
              </label>
              <label className="block">
                <span className="text-[11px] font-medium text-gray-500">추가금 (+)</span>
                <input
                  type="number" min={0} step={10000}
                  value={adj.surchargeAmount}
                  onChange={(e) => setAdj({ ...adj, surchargeAmount: Math.max(0, Number(e.target.value)) })}
                  className={`${numField} mt-1`}
                />
              </label>
            </div>

            {/* 부가세 */}
            <div>
              <span className="text-[11px] font-medium text-gray-500">부가세</span>
              <div className="mt-1 grid grid-cols-2 gap-1 rounded-lg border border-gray-200 p-0.5 text-xs">
                {(['EXCLUDED', 'INCLUDED'] as const).map((mode) => (
                  <button
                    key={mode}
                    type="button"
                    onClick={() => setAdj({ ...adj, vatMode: mode })}
                    className={`py-1.5 rounded-md font-semibold transition-colors ${
                      adj.vatMode === mode ? 'bg-blue-600 text-white' : 'text-gray-500 hover:bg-gray-50'
                    }`}
                  >
                    {mode === 'EXCLUDED' ? 'VAT 별도' : 'VAT 포함'}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* 최종 공급가 산출 체인 */}
          <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-xs">
            <h3 className="text-xs font-bold text-gray-800 flex items-center gap-1.5 mb-2">
              <ReceiptText className="w-4 h-4 text-blue-600" />
              최종 공급가 산출
            </h3>
            <dl className="text-xs divide-y divide-gray-100">
              {[
                ['엔진 산출 총 제조원가', won(computed.engineManufacturingCost)],
                [`로스율 ${adj.lossRatePct}% 조정`, `+ ${won(computed.lossAddOn)}`],
                ['조정 원가', won(computed.adjustedCost), 'strong'],
                [`목표 마진율 ${targetMarginRate}% 적용 공급가`, won(computed.targetSellingPrice)],
                adj.discountAmount ? ['할인', `− ${won(adj.discountAmount)}`] : null,
                adj.surchargeAmount ? ['추가금', `+ ${won(adj.surchargeAmount)}`] : null,
                ['순 공급가', won(computed.discountedSellingPrice - (adj.vatMode === 'INCLUDED' ? computed.vatAmount : 0)), 'strong'],
                [`부가세 (${adj.vatMode === 'INCLUDED' ? '포함' : '별도'})`, `${adj.vatMode === 'INCLUDED' ? '' : '+ '}${won(computed.vatAmount)}`],
              ]
                .filter(Boolean)
                .map((row, i) => {
                  const [label, val, strong] = row as [string, string, string?];
                  return (
                    <div key={i} className={`flex justify-between py-1.5 ${strong ? 'font-bold text-gray-900' : 'text-gray-600'}`}>
                      <dt>{label}</dt>
                      <dd className="font-mono">{val}</dd>
                    </div>
                  );
                })}
            </dl>
            <div className="mt-2 rounded-lg bg-gradient-to-br from-blue-900 to-indigo-900 text-white p-3">
              <div className="text-[11px] text-blue-200">최종 견적 총액 (VAT 포함)</div>
              <div className="text-2xl font-mono font-extrabold">{won(computed.finalTotal)}</div>
            </div>
          </div>
        </div>
      </div>

      {/* 하단 네비게이션 */}
      <div className="bg-white rounded-xl border border-gray-200 p-3 shadow-xs flex flex-col sm:flex-row items-center justify-between gap-3">
        <button
          type="button"
          onClick={onPrevStep}
          className="w-full sm:w-auto border border-gray-300 hover:bg-gray-50 text-gray-700 font-semibold px-4 py-2.5 rounded-lg text-xs flex items-center justify-center gap-1.5 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          2단계: 규격 검수로
        </button>

        {errors.length > 0 && (
          <span className="flex items-center gap-1.5 text-[11px] font-bold text-red-600">
            <AlertOctagon className="w-3.5 h-3.5" />
            계산 오류 {errors.length}건을 해결한 뒤 진행하세요.
          </span>
        )}

        <button
          type="button"
          onClick={calcDirty ? onCalculate : onNextStep}
          disabled={errors.length > 0}
          className="w-full sm:w-auto bg-blue-600 hover:bg-blue-700 disabled:bg-gray-200 disabled:text-gray-400 disabled:cursor-not-allowed text-white font-bold px-5 py-2.5 rounded-lg shadow-xs text-xs flex items-center justify-center gap-2 transition-colors"
        >
          {calcDirty ? '변경사항 반영하여 다시 계산' : '계산 확정 및 견적서 확인'}
          <ArrowRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};
