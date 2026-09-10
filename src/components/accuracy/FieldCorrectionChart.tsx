import React from 'react';
import { ParseFieldStat } from '../../types';
import { toPercent } from './AccuracySummary';

interface FieldCorrectionChartProps {
  fields: ParseFieldStat[];
  /** 지표에 반영된 파싱 건수 (막대 옆 비율의 분모) */
  sampleCount: number;
}

/**
 * 손이 많이 간 필드 순위 (가로 누적 막대)
 *
 * 프롬프트를 어디부터 고칠지 정하는 화면입니다. 두 계열을 나눠 보여주는 이유:
 * - 수정(amber): AI 가 값을 냈는데 틀렸다 → 프롬프트의 판정 규칙 문제
 * - 미추출(blue): AI 가 값을 못 냈다 → 스키마 설명이나 예시 부족
 * 원인이 다르므로 합쳐 보면 손댈 곳을 못 찾습니다.
 */
export const FieldCorrectionChart: React.FC<FieldCorrectionChartProps> = ({
  fields,
  sampleCount,
}) => {
  const rows = fields.slice(0, 12);
  const maxTotal = Math.max(1, ...rows.map((f) => f.corrected + f.missing));

  if (rows.length === 0) {
    return (
      <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-xs text-center">
        <p className="text-sm font-semibold text-gray-700">고쳐진 필드가 없습니다</p>
        <p className="mt-1 text-xs text-gray-500">
          이 기간에 확정된 견적에서는 AI 추출값이 모두 그대로 채택되었습니다.
        </p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-xs">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <div>
          <p className="text-xs font-bold text-gray-800">손이 많이 간 필드</p>
          <p className="mt-0.5 text-[11px] text-gray-500">
            확정 견적 {sampleCount}건 기준 · 상위 {rows.length}개 항목
          </p>
        </div>
        {/* 두 계열이므로 범례는 항상 둔다 */}
        <div className="flex items-center gap-3 text-[11px] text-gray-600">
          <span className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-sm bg-amber-600" />
            사람이 수정
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-sm bg-blue-600" />
            AI 미추출
          </span>
        </div>
      </div>

      <div className="mt-3.5 space-y-2.5">
        {rows.map((f) => {
          const total = f.corrected + f.missing;
          const correctedPct = (f.corrected / maxTotal) * 100;
          const missingPct = (f.missing / maxTotal) * 100;

          return (
            <div key={f.path} className="flex items-center gap-3">
              <div className="w-28 sm:w-36 shrink-0 text-right">
                <p className="text-[11px] font-semibold text-gray-700 truncate" title={f.path}>
                  {f.label}
                </p>
                <p className="text-[10px] text-gray-400">{f.group}</p>
              </div>

              {/* 막대는 하나의 기준선에서 자라고, 두 구간은 2px 간격으로 나뉜다 */}
              <div className="flex-1 min-w-0 flex items-center gap-2">
                <div className="flex-1 min-w-0 flex h-4 gap-[2px]">
                  {f.corrected > 0 && (
                    <div
                      className={`bg-amber-600 ${f.missing > 0 ? '' : 'rounded-r-[4px]'}`}
                      style={{ width: `${correctedPct}%` }}
                      title={`${f.label} 수정 ${f.corrected}건 (${toPercent(f.correctionRate, 0)})`}
                    />
                  )}
                  {f.missing > 0 && (
                    <div
                      className="bg-blue-600 rounded-r-[4px]"
                      style={{ width: `${missingPct}%` }}
                      title={`${f.label} 미추출 ${f.missing}건 (${toPercent(f.missingRate, 0)})`}
                    />
                  )}
                </div>
                {/* 값은 막대 끝 바깥에 — 막대 안에 넣으면 짧은 막대에서 잘린다 */}
                <span className="w-20 shrink-0 text-[11px] text-gray-600 tabular-nums">
                  {total}건
                  <span className="text-gray-400">
                    {' '}
                    ({toPercent(total / Math.max(sampleCount, 1), 0)})
                  </span>
                </span>
              </div>
            </div>
          );
        })}
      </div>

      <p className="mt-3 pt-3 border-t border-gray-100 text-[11px] text-gray-500">
        수정이 잦은 필드는 프롬프트의 판정 규칙을, 미추출이 잦은 필드는 응답 스키마 설명을
        먼저 손보는 편이 효과가 큽니다.
      </p>
    </div>
  );
};
