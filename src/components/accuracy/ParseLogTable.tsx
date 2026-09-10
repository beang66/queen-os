import React from 'react';
import { AiParseLogSummary } from '../../types';
import { toPercent } from './AccuracySummary';

interface ParseLogTableProps {
  logs: AiParseLogSummary[];
}

const KIND_LABEL: Record<string, string> = {
  ORDER: '주문 파싱',
  DOCUMENT: '문서 파싱',
};

const formatTime = (iso: string) =>
  new Date(iso).toLocaleString('ko-KR', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });

/**
 * 최근 파싱 이력 표.
 *
 * 집계 수치가 이상할 때 개별 건으로 되짚어보는 용도입니다. 폴백이 터진 건은
 * 실패 사유를 그대로 보여줍니다 (API 키 누락, 스키마 거부, 타임아웃 등).
 */
export const ParseLogTable: React.FC<ParseLogTableProps> = ({ logs }) => (
  <div className="bg-white rounded-xl border border-gray-200 shadow-xs overflow-hidden">
    <div className="px-4 py-3 border-b border-gray-100">
      <p className="text-xs font-bold text-gray-800">최근 파싱 이력</p>
      <p className="mt-0.5 text-[11px] text-gray-500">
        확정 전 건은 수정률이 비어 있습니다 (검수·발행 시 채워집니다).
      </p>
    </div>

    <div className="overflow-x-auto">
      <table className="w-full text-xs">
        <thead className="bg-gray-50 text-[11px] text-gray-500">
          <tr>
            <th className="px-3 py-2 text-left font-semibold">시각</th>
            <th className="px-3 py-2 text-left font-semibold">종류</th>
            <th className="px-3 py-2 text-left font-semibold">엔진</th>
            <th className="px-3 py-2 text-right font-semibold">응답</th>
            <th className="px-3 py-2 text-right font-semibold">수정</th>
            <th className="px-3 py-2 text-right font-semibold">미추출</th>
            <th className="px-3 py-2 text-right font-semibold">정확도</th>
            <th className="px-3 py-2 text-left font-semibold">비고</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {logs.length === 0 && (
            <tr>
              <td colSpan={8} className="px-3 py-6 text-center text-gray-400">
                아직 기록된 파싱 이력이 없습니다.
              </td>
            </tr>
          )}
          {logs.map((log) => (
            <tr key={log.id} className="hover:bg-gray-50/80">
              <td className="px-3 py-2 text-gray-600 whitespace-nowrap tabular-nums">
                {formatTime(log.createdAt)}
              </td>
              <td className="px-3 py-2 text-gray-700 whitespace-nowrap">
                {KIND_LABEL[log.kind] ?? log.kind}
              </td>
              <td className="px-3 py-2 whitespace-nowrap">
                <span
                  className={`inline-flex items-center gap-1.5 font-mono text-[10px] font-semibold ${
                    log.engine === 'GEMINI' ? 'text-gray-700' : 'text-rose-700'
                  }`}
                >
                  <span
                    className={`w-1.5 h-1.5 rounded-full ${
                      log.engine === 'GEMINI' ? 'bg-emerald-600' : 'bg-rose-600'
                    }`}
                  />
                  {log.engine}
                </span>
              </td>
              <td className="px-3 py-2 text-right text-gray-600 tabular-nums whitespace-nowrap">
                {(log.latencyMs / 1000).toFixed(1)}초
              </td>
              <td className="px-3 py-2 text-right tabular-nums whitespace-nowrap">
                {log.correctedCount === undefined ? (
                  <span className="text-gray-300">—</span>
                ) : (
                  <span className={log.correctedCount > 0 ? 'font-semibold text-amber-700' : 'text-gray-600'}>
                    {log.correctedCount}
                  </span>
                )}
              </td>
              <td className="px-3 py-2 text-right tabular-nums whitespace-nowrap">
                {log.missingCount === undefined ? (
                  <span className="text-gray-300">—</span>
                ) : (
                  <span className={log.missingCount > 0 ? 'font-semibold text-blue-700' : 'text-gray-600'}>
                    {log.missingCount}
                  </span>
                )}
              </td>
              <td className="px-3 py-2 text-right tabular-nums whitespace-nowrap text-gray-700">
                {log.accuracyRate === undefined ? (
                  <span className="text-gray-300">확정 대기</span>
                ) : (
                  toPercent(log.accuracyRate, 0)
                )}
              </td>
              <td className="px-3 py-2 text-gray-500 max-w-[220px]">
                <span className="block truncate" title={log.errorMessage || ''}>
                  {log.errorMessage
                    ? log.errorMessage
                    : log.kind === 'DOCUMENT' && log.itemCount !== undefined
                      ? `품목 ${log.itemCount}건 추출`
                      : ''}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  </div>
);
