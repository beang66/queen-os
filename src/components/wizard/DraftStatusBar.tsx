import React from 'react';
import {
  AlertTriangle,
  Check,
  CloudOff,
  Loader2,
  RefreshCw,
  Save,
  Users,
} from 'lucide-react';
import { SaveState } from '../../hooks/useQuoteDraft';
import { QuoteDraft } from '../../types';

interface DraftStatusBarProps {
  draftId: string | null;
  revision: number;
  saveState: SaveState;
  lastSavedAt: string | null;
  errorMessage: string | null;
  conflictDraft: QuoteDraft | null;
  pricingChanged: boolean;
  onSaveNow: () => void;
  onAcceptServer: () => void;
  onOverwriteMine: () => void;
  onRecalculate: () => void;
  onDismissPricingChange: () => void;
}

const timeLabel = (iso: string | null) => {
  if (!iso) return '';
  const d = new Date(iso);
  const p = (n: number) => String(n).padStart(2, '0');
  return `${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
};

const STATE_META: Record<SaveState, { text: string; cls: string }> = {
  IDLE: { text: '초안 없음', cls: 'text-gray-500 bg-gray-100 border-gray-200' },
  DIRTY: { text: '변경됨 — 곧 저장', cls: 'text-amber-700 bg-amber-50 border-amber-200' },
  SAVING: { text: '저장 중', cls: 'text-blue-700 bg-blue-50 border-blue-200' },
  SAVED: { text: '저장됨', cls: 'text-emerald-700 bg-emerald-50 border-emerald-200' },
  ERROR: { text: '저장 실패', cls: 'text-red-700 bg-red-50 border-red-200' },
  CONFLICT: { text: '충돌 발생', cls: 'text-orange-700 bg-orange-50 border-orange-200' },
};

/**
 * 견적 초안의 저장 상태 표시줄.
 * 자동 저장 진행 상황, 수동 임시 저장, 동시 편집 충돌, 단가 변경 안내를 담당한다.
 */
export const DraftStatusBar: React.FC<DraftStatusBarProps> = ({
  draftId,
  revision,
  saveState,
  lastSavedAt,
  errorMessage,
  conflictDraft,
  pricingChanged,
  onSaveNow,
  onAcceptServer,
  onOverwriteMine,
  onRecalculate,
  onDismissPricingChange,
}) => {
  const meta = STATE_META[saveState];

  return (
    <div className="space-y-2">
      <div className="bg-white rounded-xl border border-gray-200 px-3 py-2 shadow-xs flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2 min-w-0">
          <span className={`flex items-center gap-1.5 text-[11px] font-bold px-2 py-1 rounded border ${meta.cls}`}>
            {saveState === 'SAVING' && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
            {saveState === 'SAVED' && <Check className="w-3.5 h-3.5" />}
            {saveState === 'ERROR' && <CloudOff className="w-3.5 h-3.5" />}
            {saveState === 'CONFLICT' && <Users className="w-3.5 h-3.5" />}
            {saveState === 'DIRTY' && <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />}
            {meta.text}
          </span>

          {lastSavedAt && saveState !== 'CONFLICT' && (
            <span className="text-[11px] text-gray-400 font-mono truncate">
              {timeLabel(lastSavedAt)} · rev.{revision}
            </span>
          )}

          {draftId && (
            <span className="hidden lg:inline text-[10px] text-gray-300 font-mono truncate" title={draftId}>
              {draftId}
            </span>
          )}
        </div>

        <button
          type="button"
          onClick={onSaveNow}
          disabled={!draftId || saveState === 'SAVING'}
          className="shrink-0 border border-gray-300 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed text-gray-700 font-semibold px-3 py-1.5 rounded-lg text-[11px] flex items-center gap-1.5 transition-colors"
        >
          <Save className="w-3.5 h-3.5 text-blue-500" />
          임시 저장
        </button>
      </div>

      {/* 저장 실패 — 브라우저 백업 안내 */}
      {saveState === 'ERROR' && errorMessage && (
        <div className="flex items-start gap-2 text-[11px] text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
          <CloudOff className="w-4 h-4 shrink-0 mt-px" />
          <div>
            <p className="font-bold">{errorMessage}</p>
            <p className="text-red-600/90">
              작업 내용은 브라우저에 임시 보관되어 있습니다. 연결이 복구되면 [임시 저장]을 눌러 다시 저장하세요.
            </p>
          </div>
        </div>
      )}

      {/* 동시 편집 충돌 */}
      {saveState === 'CONFLICT' && conflictDraft && (
        <div className="flex flex-col sm:flex-row sm:items-center gap-2 text-[11px] text-orange-800 bg-orange-50 border border-orange-200 rounded-lg px-3 py-2">
          <div className="flex items-start gap-2 flex-1 min-w-0">
            <Users className="w-4 h-4 shrink-0 mt-px" />
            <div>
              <p className="font-bold">다른 창에서 이 초안을 먼저 수정했습니다.</p>
              <p className="text-orange-700/90">
                서버 최신본은 rev.{conflictDraft.revision} ({timeLabel(conflictDraft.updatedAt)}) 입니다.
                어느 쪽을 남길지 선택하세요. 이 창의 변경사항은 브라우저에 백업되어 있습니다.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            <button
              type="button"
              onClick={onAcceptServer}
              className="border border-orange-300 bg-white hover:bg-orange-100 text-orange-800 font-bold px-2.5 py-1.5 rounded-lg transition-colors"
            >
              최신본 불러오기
            </button>
            <button
              type="button"
              onClick={onOverwriteMine}
              className="bg-orange-600 hover:bg-orange-700 text-white font-bold px-2.5 py-1.5 rounded-lg transition-colors"
            >
              이 창 내용으로 덮어쓰기
            </button>
          </div>
        </div>
      )}

      {/* 단가표 변경 감지 */}
      {pricingChanged && (
        <div className="flex flex-col sm:flex-row sm:items-center gap-2 text-[11px] text-blue-800 bg-blue-50 border border-blue-200 rounded-lg px-3 py-2">
          <div className="flex items-start gap-2 flex-1 min-w-0">
            <AlertTriangle className="w-4 h-4 shrink-0 mt-px" />
            <div>
              <p className="font-bold">이 초안을 계산한 이후 단가표가 변경되었습니다.</p>
              <p className="text-blue-700/90">
                현재 금액은 변경 전 단가 기준입니다. 최신 단가를 반영하려면 다시 계산하세요.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            <button
              type="button"
              onClick={onDismissPricingChange}
              className="border border-blue-300 bg-white hover:bg-blue-100 text-blue-800 font-bold px-2.5 py-1.5 rounded-lg transition-colors"
            >
              현재 금액 유지
            </button>
            <button
              type="button"
              onClick={onRecalculate}
              className="bg-blue-600 hover:bg-blue-700 text-white font-bold px-2.5 py-1.5 rounded-lg transition-colors flex items-center gap-1.5"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              최신 단가로 다시 계산
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
