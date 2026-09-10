import React, { useState } from 'react';
import { Loader2, RefreshCw, Sparkles } from 'lucide-react';
import { AccuracySummary } from './accuracy/AccuracySummary';
import { FieldCorrectionChart } from './accuracy/FieldCorrectionChart';
import { ParseLogTable } from './accuracy/ParseLogTable';
import { useParseAccuracyStats, useParseLogs, PARSE_ACCURACY_QUERY_KEY } from '../hooks/queries';
import { queryClient } from '../lib/queryClient';

const PERIOD_OPTIONS = [7, 30, 90] as const;

/**
 * 퀸 주방가구 AI 파싱 정확도 대시보드 (ParseAccuracyDashboard) 메인 컨테이너 컴포넌트
 *
 * Gemini 가 뽑아준 주문 정보를 사람이 규격 검수·발행 단계에서 얼마나 고쳤는지를
 * 필드 단위로 집계해 보여줍니다. 프롬프트를 어디부터 손볼지 정하는 화면입니다.
 */
export const ParseAccuracyDashboard: React.FC = () => {
  const [days, setDays] = useState<number>(30);

  const { data: stats, isLoading, error } = useParseAccuracyStats(days);
  const { data: logs = [] } = useParseLogs(20);

  const handleRefresh = () => {
    queryClient.invalidateQueries({ queryKey: PARSE_ACCURACY_QUERY_KEY });
  };

  return (
    <div className="max-w-6xl mx-auto space-y-4">
      {/* 헤더 & 기간 필터 */}
      <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-xs flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-sm font-bold text-gray-900 flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-blue-500" />
            AI 파싱 정확도
          </h2>
          <p className="mt-0.5 text-[11px] text-gray-500">
            AI 추출값과 사람이 확정한 값을 필드 단위로 대조한 결과입니다.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <div className="flex items-center rounded-lg border border-gray-200 overflow-hidden">
            {PERIOD_OPTIONS.map((option) => (
              <button
                key={option}
                type="button"
                onClick={() => setDays(option)}
                className={`px-3 py-1.5 text-[11px] font-semibold transition-colors ${
                  days === option
                    ? 'bg-blue-600 text-white'
                    : 'bg-white text-gray-600 hover:bg-gray-50'
                }`}
              >
                최근 {option}일
              </button>
            ))}
          </div>
          <button
            type="button"
            onClick={handleRefresh}
            className="flex items-center gap-1.5 border border-gray-200 bg-white hover:bg-gray-50 text-gray-600 text-[11px] font-semibold px-2.5 py-1.5 rounded-lg transition-colors"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            새로고침
          </button>
        </div>
      </div>

      {isLoading && (
        <div className="bg-white rounded-xl border border-gray-200 p-10 flex flex-col items-center gap-3 text-sm text-gray-500">
          <Loader2 className="w-6 h-6 animate-spin text-blue-500" />
          파싱 정확도를 집계하고 있습니다...
        </div>
      )}

      {error && (
        <div className="bg-white rounded-xl border border-rose-200 p-5 text-sm text-rose-700">
          <p className="font-semibold">집계를 불러오지 못했습니다.</p>
          <p className="mt-1 text-xs text-rose-600 whitespace-pre-line">{(error as Error).message}</p>
        </div>
      )}

      {stats && stats.totalParseCount === 0 && (
        <div className="bg-white rounded-xl border border-gray-200 p-8 text-center">
          <p className="text-sm font-semibold text-gray-700">
            최근 {days}일 동안 기록된 AI 파싱이 없습니다
          </p>
          <p className="mt-1.5 text-xs text-gray-500 leading-relaxed">
            신규 견적 화면에서 [AI 정보 추출]을 실행하면 파싱 결과가 기록되고,
            <br />
            규격 검수를 마치거나 견적서를 발행할 때 수정 내역이 이 화면에 쌓입니다.
          </p>
        </div>
      )}

      {stats && stats.totalParseCount > 0 && (
        <>
          {stats.sampleCount === 0 ? (
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-xs text-amber-800">
              파싱 {stats.totalParseCount}건이 기록됐지만 아직 확정된 건이 없어 수정률을 낼 수 없습니다.
              규격 검수를 마치거나 견적서를 발행하면 지표가 채워집니다.
            </div>
          ) : (
            <>
              <AccuracySummary stats={stats} />
              <FieldCorrectionChart fields={stats.worstFields} sampleCount={stats.sampleCount} />
            </>
          )}
          <ParseLogTable logs={logs} />
        </>
      )}
    </div>
  );
};
