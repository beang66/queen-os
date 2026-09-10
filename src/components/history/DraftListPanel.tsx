import React, { useCallback, useEffect, useState } from 'react';
import { Archive, FileClock, History, Loader2, PlayCircle, RefreshCw, Trash2, Undo2 } from 'lucide-react';
import { DraftStatus, QuoteDraft, QuoteDraftSummary } from '../../types';
import { fetchJson, fetchValidated } from '../../lib/api';
import { DraftListResponse, DraftResponse } from '../../schemas';

interface DraftListPanelProps {
  onResumeDraft: (id: string) => void;
}

const STEP_LABELS: Record<number, string> = {
  1: '자료 입력',
  2: '규격 검수',
  3: '원가 계산',
  4: '견적서 발행',
};

const STATUS_META: Record<DraftStatus, { label: string; cls: string }> = {
  ACTIVE: { label: '작성 중', cls: 'text-blue-700 bg-blue-50 border-blue-200' },
  PUBLISHED: { label: '발행 완료', cls: 'text-emerald-700 bg-emerald-50 border-emerald-200' },
  ARCHIVED: { label: '보관됨', cls: 'text-gray-600 bg-gray-100 border-gray-200' },
};

const FILTERS: Array<{ key: DraftStatus | 'ALL'; label: string }> = [
  { key: 'ACTIVE', label: '작성 중' },
  { key: 'PUBLISHED', label: '발행 완료' },
  { key: 'ARCHIVED', label: '보관됨' },
  { key: 'ALL', label: '전체' },
];

const won = (n: number) => `₩${Math.round(n).toLocaleString()}`;
const stamp = (iso: string) => new Date(iso).toLocaleString('ko-KR', { hour12: false }).slice(0, 17);

/**
 * 견적 관리 - 작성 중인 초안 목록.
 * 초안을 이어서 작성하거나, 변경 이력에서 이전 상태로 되돌릴 수 있습니다.
 */
export const DraftListPanel: React.FC<DraftListPanelProps> = ({ onResumeDraft }) => {
  const [filter, setFilter] = useState<DraftStatus | 'ALL'>('ACTIVE');
  const [drafts, setDrafts] = useState<QuoteDraftSummary[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  /** 변경 이력을 펼친 초안 */
  const [historyOf, setHistoryOf] = useState<QuoteDraft | null>(null);
  const [historyLoadingId, setHistoryLoadingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetchValidated(DraftListResponse, `/api/drafts?status=${filter}`);
      setDrafts(res.data);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [filter]);

  useEffect(() => {
    void load();
  }, [load]);

  const handleDelete = async (id: string) => {
    if (!confirm('이 초안을 삭제할까요? 되돌릴 수 없습니다.')) return;
    try {
      await fetchJson(`/api/drafts/${id}`, { method: 'DELETE' });
      setHistoryOf((h) => (h?.id === id ? null : h));
      await load();
    } catch (err: any) {
      alert(`초안 삭제 오류: ${err.message}`);
    }
  };

  const handleToggleHistory = async (id: string) => {
    if (historyOf?.id === id) {
      setHistoryOf(null);
      return;
    }
    setHistoryLoadingId(id);
    try {
      const res = await fetchValidated(DraftResponse, `/api/drafts/${id}`);
      setHistoryOf(res.data);
    } catch (err: any) {
      alert(`변경 이력 조회 오류: ${err.message}`);
    } finally {
      setHistoryLoadingId(null);
    }
  };

  const handleRestore = async (id: string, revision: number) => {
    if (!confirm(`rev.${revision} 시점의 내용으로 되돌릴까요? 현재 내용도 이력에 남습니다.`)) return;
    try {
      await fetchJson(`/api/drafts/${id}/restore`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ revision }),
      });
      setHistoryOf(null);
      await load();
      alert(`rev.${revision} 상태로 복구했습니다. [이어서 작성]으로 확인하세요.`);
    } catch (err: any) {
      alert(`복구 오류: ${err.message}`);
    }
  };

  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-xs">
      <div className="flex items-center justify-between gap-3 p-4 border-b border-gray-100 flex-wrap">
        <div className="flex items-center gap-2">
          <FileClock className="w-4 h-4 text-blue-500" />
          <h3 className="text-sm font-bold text-gray-800">견적 초안</h3>
          <span className="text-[11px] text-gray-400">작성 중인 견적이 자동 저장됩니다</span>
        </div>

        <div className="flex items-center gap-1.5">
          {FILTERS.map((f) => (
            <button
              key={f.key}
              type="button"
              onClick={() => setFilter(f.key)}
              className={`text-[11px] font-semibold px-2.5 py-1.5 rounded-lg border transition-colors ${
                filter === f.key
                  ? 'bg-[#1e293b] text-white border-[#1e293b]'
                  : 'bg-white text-gray-500 border-gray-200 hover:border-gray-300'
              }`}
            >
              {f.label}
            </button>
          ))}
          <button
            type="button"
            onClick={() => void load()}
            className="text-gray-400 hover:text-blue-600 p-1.5 rounded-lg border border-gray-200 hover:border-blue-300 transition-colors"
            title="새로고침"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {error && (
        <p className="px-4 py-6 text-center text-xs text-red-600">{error}</p>
      )}

      {!error && loading && drafts.length === 0 && (
        <p className="px-4 py-10 text-center text-xs text-gray-400 flex items-center justify-center gap-2">
          <Loader2 className="w-4 h-4 animate-spin" /> 불러오는 중...
        </p>
      )}

      {!error && !loading && drafts.length === 0 && (
        <p className="px-4 py-10 text-center text-xs text-gray-400">
          {filter === 'ACTIVE' ? '작성 중인 초안이 없습니다.' : '해당 상태의 초안이 없습니다.'}
        </p>
      )}

      <ul className="divide-y divide-gray-100">
        {drafts.map((d) => (
          <li key={d.id}>
            <div className="flex items-center gap-3 px-4 py-3 flex-wrap">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-xs font-bold text-gray-800 truncate">
                    {d.customerName || '고객 미지정'}
                    {d.projectName ? ` · ${d.projectName}` : ''}
                  </span>
                  <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded border ${STATUS_META[d.status].cls}`}>
                    {STATUS_META[d.status].label}
                  </span>
                  <span className="text-[10px] font-semibold text-gray-500 bg-gray-100 border border-gray-200 px-1.5 py-0.5 rounded">
                    {STEP_LABELS[d.step]}
                  </span>
                </div>
                <p className="text-[11px] text-gray-500 mt-0.5 truncate">{d.quoteTitle}</p>
                <p className="text-[11px] text-gray-400 font-mono mt-0.5">
                  품목 {d.itemCount}건
                  {d.totalAmount !== null && <> · {won(d.totalAmount)}</>}
                  {' · '}rev.{d.revision} · {stamp(d.updatedAt)}
                </p>
              </div>

              <div className="flex items-center gap-1.5 shrink-0">
                <button
                  type="button"
                  onClick={() => void handleToggleHistory(d.id)}
                  className="text-[11px] font-semibold text-gray-600 border border-gray-200 hover:border-blue-300 hover:text-blue-600 px-2.5 py-1.5 rounded-lg flex items-center gap-1.5 transition-colors"
                >
                  {historyLoadingId === d.id ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <History className="w-3.5 h-3.5" />
                  )}
                  변경 이력
                </button>
                <button
                  type="button"
                  onClick={() => onResumeDraft(d.id)}
                  className="text-[11px] font-bold text-white bg-blue-600 hover:bg-blue-700 px-2.5 py-1.5 rounded-lg flex items-center gap-1.5 transition-colors"
                >
                  <PlayCircle className="w-3.5 h-3.5" />
                  이어서 작성
                </button>
                <button
                  type="button"
                  onClick={() => void handleDelete(d.id)}
                  className="text-gray-300 hover:text-red-500 p-1.5 transition-colors"
                  title="초안 삭제"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* 변경 이력 및 이전 상태 복구 */}
            {historyOf?.id === d.id && (
              <div className="px-4 pb-3 -mt-1">
                <div className="rounded-lg border border-gray-200 bg-slate-50/60 p-2.5">
                  <p className="text-[11px] font-bold text-gray-600 mb-1.5 flex items-center gap-1.5">
                    <Archive className="w-3.5 h-3.5 text-gray-400" />
                    저장 시점 {historyOf.history.length}건 (최근 순)
                  </p>
                  <ul className="space-y-1 max-h-56 overflow-y-auto">
                    {[...historyOf.history].reverse().map((h) => (
                      <li
                        key={h.revision}
                        className="flex items-center justify-between gap-2 bg-white border border-gray-100 rounded-md px-2 py-1.5"
                      >
                        <span className="min-w-0 text-[11px]">
                          <b className="font-mono text-gray-700">rev.{h.revision}</b>
                          <span className="text-gray-500"> · {h.label}</span>
                          <span className="text-gray-400 font-mono"> · {stamp(h.savedAt)}</span>
                        </span>
                        <button
                          type="button"
                          disabled={h.revision === historyOf.revision}
                          onClick={() => void handleRestore(d.id, h.revision)}
                          className="shrink-0 text-[11px] font-semibold text-gray-600 border border-gray-200 hover:border-blue-300 hover:text-blue-600 disabled:opacity-40 disabled:cursor-not-allowed px-2 py-1 rounded flex items-center gap-1 transition-colors"
                        >
                          <Undo2 className="w-3 h-3" />
                          {h.revision === historyOf.revision ? '현재' : '이 시점으로'}
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
};
