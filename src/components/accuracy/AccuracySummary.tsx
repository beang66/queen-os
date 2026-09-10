import React from 'react';
import { AlertTriangle, Clock, PencilLine, ShieldCheck, Timer } from 'lucide-react';
import { ParseAccuracyStats } from '../../types';

/** 비율(0~1)을 백분율 문자열로 */
export const toPercent = (rate: number, digits = 1) => `${(rate * 100).toFixed(digits)}%`;

interface StatTileProps {
  label: string;
  value: string;
  /** 값 아래 한 줄 보충 설명 (분자/분모 등) */
  hint?: string;
  icon: React.ReactNode;
  /** 주의가 필요한 수치일 때 강조 */
  alert?: boolean;
}

const StatTile: React.FC<StatTileProps> = ({ label, value, hint, icon, alert }) => (
  <div className="bg-white rounded-xl border border-gray-200 p-3.5 shadow-xs">
    <div className="flex items-center gap-1.5 text-[11px] font-semibold text-gray-500">
      {icon}
      <span>{label}</span>
    </div>
    <p
      className={`mt-1.5 text-2xl font-bold tracking-tight ${
        alert ? 'text-amber-700' : 'text-gray-900'
      }`}
    >
      {value}
    </p>
    {hint && <p className="mt-0.5 text-[11px] text-gray-400">{hint}</p>}
  </div>
);

interface AccuracySummaryProps {
  stats: ParseAccuracyStats;
}

/**
 * AI 파싱 정확도 요약 (히어로 수치 + KPI 타일 + 엔진별 비교)
 *
 * 정확도 한 수치를 크게 앞세우고, 나머지는 그 수치를 설명하는 보조 지표로 둡니다.
 * 지표의 분모는 "사람이 확정까지 마친 파싱 건"이며, 확정 대기 건은 따로 보여줍니다.
 */
export const AccuracySummary: React.FC<AccuracySummaryProps> = ({ stats }) => {
  const missingRate = stats.trackedCount === 0 ? 0 : stats.missingCount / stats.trackedCount;

  return (
    <div className="space-y-3">
      {/* 히어로 수치 — 이 화면이 답하는 단 하나의 질문 */}
      <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-xs flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
        <div>
          <p className="text-xs font-semibold text-gray-500">
            AI 파싱 정확도 · 최근 {stats.periodDays}일
          </p>
          <p className="mt-1 text-5xl font-bold tracking-tight text-gray-900 leading-none">
            {toPercent(stats.accuracyRate)}
          </p>
          <p className="mt-2 text-xs text-gray-500">
            확정 견적 {stats.sampleCount}건에서 검사한 {stats.trackedCount.toLocaleString()}개 항목 중{' '}
            <span className="font-semibold text-gray-700">
              {stats.matchedCount.toLocaleString()}개
            </span>
            를 그대로 채택했습니다.
          </p>
        </div>

        {/* 채택 / 수정 / 미추출 구성 — 100% 가로 막대 */}
        <div className="w-full sm:w-72 shrink-0">
          <div className="flex h-4 w-full gap-[2px]">
            <div
              className="bg-emerald-600 rounded-l-[4px]"
              style={{ width: `${stats.accuracyRate * 100}%` }}
              title={`그대로 채택 ${stats.matchedCount}개`}
            />
            <div
              className="bg-amber-600"
              style={{ width: `${stats.correctionRate * 100}%` }}
              title={`사람이 수정 ${stats.correctedCount}개`}
            />
            <div
              className="bg-blue-600 rounded-r-[4px]"
              style={{ width: `${missingRate * 100}%` }}
              title={`AI 미추출 ${stats.missingCount}개`}
            />
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-gray-600">
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-sm bg-emerald-600" />
              채택 {stats.matchedCount}
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-sm bg-amber-600" />
              수정 {stats.correctedCount}
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-sm bg-blue-600" />
              미추출 {stats.missingCount}
            </span>
          </div>
        </div>
      </div>

      {/* 보조 지표 */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        <StatTile
          label="수정률"
          value={toPercent(stats.correctionRate)}
          hint={`${stats.correctedCount}개 항목을 고침`}
          icon={<PencilLine className="w-3.5 h-3.5 text-amber-600" />}
          alert={stats.correctionRate >= 0.15}
        />
        <StatTile
          label="미추출률"
          value={toPercent(missingRate)}
          hint={`${stats.missingCount}개 항목을 사람이 채움`}
          icon={<AlertTriangle className="w-3.5 h-3.5 text-blue-600" />}
          alert={missingRate >= 0.15}
        />
        <StatTile
          label="폴백률"
          value={toPercent(stats.fallbackRate)}
          hint={`전체 ${stats.totalParseCount}건 중 ${stats.fallbackCount}건 규칙 기반 처리`}
          icon={<ShieldCheck className="w-3.5 h-3.5 text-rose-600" />}
          alert={stats.fallbackRate >= 0.1}
        />
        <StatTile
          label="평균 응답"
          value={`${(stats.averageLatencyMs / 1000).toFixed(1)}초`}
          hint={`파싱 호출 ${stats.totalParseCount}건 평균`}
          icon={<Timer className="w-3.5 h-3.5 text-gray-500" />}
        />
        <StatTile
          label="확정 대기"
          value={`${stats.pendingConfirmCount}건`}
          hint="검수 전이라 지표 미반영"
          icon={<Clock className="w-3.5 h-3.5 text-gray-500" />}
        />
      </div>

      {/* 엔진별 비교 — Gemini 응답과 규칙 기반 폴백을 섞어 보면 지표가 흐려진다 */}
      {stats.byEngine.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-xs">
          <p className="text-xs font-bold text-gray-800">엔진별 정확도</p>
          <p className="mt-0.5 text-[11px] text-gray-500">
            HEURISTIC 은 Gemini 호출이 실패해 규칙 기반 파서로 처리된 건입니다.
          </p>
          <div className="mt-3 space-y-2.5">
            {stats.byEngine.map((e) => (
              <div key={e.engine} className="flex items-center gap-3">
                <span className="w-24 shrink-0 text-[11px] font-mono font-semibold text-gray-700">
                  {e.engine}
                </span>
                <div className="flex-1 h-4 bg-gray-100 rounded-[4px] overflow-hidden">
                  <div
                    className="h-full bg-emerald-600 rounded-r-[4px]"
                    style={{ width: `${Math.max(e.accuracyRate * 100, 0.5)}%` }}
                    title={`정확도 ${toPercent(e.accuracyRate)}`}
                  />
                </div>
                <span className="w-32 shrink-0 text-right text-[11px] text-gray-600 tabular-nums">
                  정확도 {toPercent(e.accuracyRate)}
                  <span className="text-gray-400"> · {e.sampleCount}건</span>
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
