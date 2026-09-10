import { useCallback, useEffect, useRef, useState } from 'react';
import { DraftPayload, QuoteDraft } from '../types';
import { ApiError, NetworkError, fetchValidated } from '../lib/api';
import { DraftResponse } from '../schemas';
import { queryClient } from '../lib/queryClient';
import { DRAFTS_QUERY_KEY } from './queries';

/** 저장 상태 — 화면 우측 상단 뱃지에 그대로 표시된다. */
export type SaveState = 'IDLE' | 'DIRTY' | 'SAVING' | 'SAVED' | 'ERROR' | 'CONFLICT';

/** 입력이 멈춘 뒤 이만큼 지나면 자동 저장한다. */
const AUTOSAVE_DEBOUNCE_MS = 1500;
/** 계속 타이핑 중이어도 최소 이 주기로는 한 번 저장한다. */
const AUTOSAVE_MAX_WAIT_MS = 15_000;

const EDITOR_ID_KEY = 'queen-os:editor-id';
const ACTIVE_DRAFT_KEY = 'queen-os:active-draft-id';
const backupKey = (draftId: string) => `queen-os:draft-backup:${draftId}`;

/** 창(탭)마다 고유한 편집자 식별자. 다른 창이 저장했는지 판별하는 데 쓴다. */
function getEditorId(): string {
  try {
    const existing = sessionStorage.getItem(EDITOR_ID_KEY);
    if (existing) return existing;
    const id = `ed-${Math.random().toString(36).slice(2, 10)}`;
    sessionStorage.setItem(EDITOR_ID_KEY, id);
    return id;
  } catch {
    return `ed-${Math.random().toString(36).slice(2, 10)}`;
  }
}

/** 서버 저장이 실패했을 때 쓰는 브라우저 임시 백업 */
export function readLocalBackup(draftId: string): { payload: DraftPayload; savedAt: string } | null {
  try {
    const raw = localStorage.getItem(backupKey(draftId));
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function writeLocalBackup(draftId: string, payload: DraftPayload) {
  try {
    localStorage.setItem(backupKey(draftId), JSON.stringify({ payload, savedAt: new Date().toISOString() }));
  } catch {
    /* 용량 초과 등은 무시 — 백업은 최선 노력(best effort) */
  }
}

function clearLocalBackup(draftId: string) {
  try {
    localStorage.removeItem(backupKey(draftId));
  } catch {
    /* noop */
  }
}

/** 마지막으로 작업하던 초안 id (메뉴 이동 후 복원용) */
export function getActiveDraftId(): string | null {
  try {
    return localStorage.getItem(ACTIVE_DRAFT_KEY);
  } catch {
    return null;
  }
}

function setActiveDraftId(id: string | null) {
  try {
    if (id) localStorage.setItem(ACTIVE_DRAFT_KEY, id);
    else localStorage.removeItem(ACTIVE_DRAFT_KEY);
  } catch {
    /* noop */
  }
}

interface UseQuoteDraftResult {
  draftId: string | null;
  revision: number;
  saveState: SaveState;
  lastSavedAt: string | null;
  errorMessage: string | null;
  /** 다른 창이 먼저 저장해 충돌한 경우의 서버 최신본 */
  conflictDraft: QuoteDraft | null;
  /** 초안 저장 시점 이후 단가표가 바뀌었는지 */
  pricingChanged: boolean;
  createDraft: (payload: DraftPayload) => Promise<QuoteDraft | null>;
  loadDraft: (id: string) => Promise<QuoteDraft | null>;
  /** 변경 감지 → 자동 저장 예약 */
  scheduleSave: (payload: DraftPayload) => void;
  /** 수동 임시 저장 (예약된 자동 저장을 취소하고 즉시 저장) */
  saveNow: (payload: DraftPayload, label?: string) => Promise<boolean>;
  /** 충돌 해소 — 서버 최신본 채택 */
  acceptServerVersion: () => QuoteDraft | null;
  /** 충돌 해소 — 내 변경사항으로 덮어쓰기 */
  overwriteWithMine: (payload: DraftPayload) => Promise<boolean>;
  markPublished: () => void;
  detach: () => void;
  acknowledgePricingChange: () => void;
}

/**
 * 견적 초안의 생명주기를 담당하는 훅.
 * 초안 생성 → 단계별 변경 자동 저장 → 충돌 감지 → 발행까지를 하나의 초안 id 로 묶는다.
 */
export function useQuoteDraft(): UseQuoteDraftResult {
  const editorIdRef = useRef<string>(getEditorId());

  const [draftId, setDraftId] = useState<string | null>(null);
  const [revision, setRevision] = useState<number>(0);
  const [saveState, setSaveState] = useState<SaveState>('IDLE');
  const [lastSavedAt, setLastSavedAt] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [conflictDraft, setConflictDraft] = useState<QuoteDraft | null>(null);
  const [pricingChanged, setPricingChanged] = useState<boolean>(false);

  // 타이머/최신값은 렌더와 무관하게 유지해야 하므로 ref 로 둔다.
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const maxWaitRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingPayloadRef = useRef<DraftPayload | null>(null);
  const revisionRef = useRef<number>(0);
  const draftIdRef = useRef<string | null>(null);
  const inFlightRef = useRef<boolean>(false);

  const clearTimers = () => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (maxWaitRef.current) clearTimeout(maxWaitRef.current);
    debounceRef.current = null;
    maxWaitRef.current = null;
  };

  const applyDraft = useCallback((draft: QuoteDraft) => {
    setDraftId(draft.id);
    draftIdRef.current = draft.id;
    setRevision(draft.revision);
    revisionRef.current = draft.revision;
    setLastSavedAt(draft.updatedAt);
    setActiveDraftId(draft.id);
  }, []);

  /** 실제 저장 수행. 성공 시 revision 을 서버 값으로 동기화한다. */
  const performSave = useCallback(
    async (payload: DraftPayload, label: string): Promise<boolean> => {
      const id = draftIdRef.current;
      if (!id) return false;
      if (inFlightRef.current) {
        // 이전 저장이 아직 끝나지 않았으면 값만 갱신해 두고 끝나는 대로 이어서 저장한다.
        pendingPayloadRef.current = payload;
        return false;
      }

      inFlightRef.current = true;
      setSaveState('SAVING');
      setErrorMessage(null);

      try {
        const res = await fetchValidated(DraftResponse, `/api/drafts/${id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            revision: revisionRef.current,
            payload,
            label,
            editorId: editorIdRef.current,
          }),
        });

        setRevision(res.data.revision);
        revisionRef.current = res.data.revision;
        setLastSavedAt(res.data.updatedAt);
        setSaveState('SAVED');
        setConflictDraft(null);
        clearLocalBackup(id);
        void queryClient.invalidateQueries({ queryKey: DRAFTS_QUERY_KEY });
        return true;
      } catch (err: any) {
        // 409 = 다른 창에서 먼저 저장함. 내 변경사항을 잃지 않도록 로컬에 백업해 둔다.
        if (err instanceof ApiError && err.status === 409) {
          writeLocalBackup(id, payload);
          setConflictDraft(err.payload?.data ?? null);
          setSaveState('CONFLICT');
          setErrorMessage('다른 창에서 이 초안을 먼저 수정했습니다.');
          return false;
        }
        writeLocalBackup(id, payload);
        setSaveState('ERROR');
        setErrorMessage(
          err instanceof NetworkError
            ? '서버에 연결할 수 없어 브라우저에 임시 백업했습니다.'
            : `저장 실패: ${err.message}`
        );
        return false;
      } finally {
        inFlightRef.current = false;
        // 저장 중에 들어온 최신 변경이 있으면 이어서 저장한다.
        const queued = pendingPayloadRef.current;
        if (queued) {
          pendingPayloadRef.current = null;
          void performSave(queued, '자동 저장');
        }
      }
    },
    []
  );

  const createDraft = useCallback(
    async (payload: DraftPayload): Promise<QuoteDraft | null> => {
      setSaveState('SAVING');
      try {
        const res = await fetchValidated(DraftResponse, '/api/drafts', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ payload, editorId: editorIdRef.current }),
        });
        applyDraft(res.data);
        setSaveState('SAVED');
        setPricingChanged(false);
        void queryClient.invalidateQueries({ queryKey: DRAFTS_QUERY_KEY });
        return res.data;
      } catch (err: any) {
        setSaveState('ERROR');
        setErrorMessage(`초안 생성 실패: ${err.message}`);
        return null;
      }
    },
    [applyDraft]
  );

  const loadDraft = useCallback(
    async (id: string): Promise<QuoteDraft | null> => {
      try {
        const res = await fetchValidated(DraftResponse, `/api/drafts/${id}`);
        applyDraft(res.data);
        setSaveState('SAVED');
        setConflictDraft(null);
        setErrorMessage(null);
        setPricingChanged(!!res.meta?.pricingChanged);
        return res.data;
      } catch (err: any) {
        setSaveState('ERROR');
        setErrorMessage(`초안 불러오기 실패: ${err.message}`);
        return null;
      }
    },
    [applyDraft]
  );

  const scheduleSave = useCallback(
    (payload: DraftPayload) => {
      if (!draftIdRef.current) return;
      pendingPayloadRef.current = payload;
      setSaveState((prev) => (prev === 'CONFLICT' ? prev : 'DIRTY'));

      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => {
        clearTimers();
        const next = pendingPayloadRef.current;
        pendingPayloadRef.current = null;
        if (next) void performSave(next, '자동 저장');
      }, AUTOSAVE_DEBOUNCE_MS);

      // 입력이 끊이지 않아도 최대 대기 시간마다 한 번은 저장되도록 보장한다.
      if (!maxWaitRef.current) {
        maxWaitRef.current = setTimeout(() => {
          clearTimers();
          const next = pendingPayloadRef.current;
          pendingPayloadRef.current = null;
          if (next) void performSave(next, '자동 저장');
        }, AUTOSAVE_MAX_WAIT_MS);
      }
    },
    [performSave]
  );

  const saveNow = useCallback(
    async (payload: DraftPayload, label = '수동 임시 저장') => {
      clearTimers();
      pendingPayloadRef.current = null;
      return performSave(payload, label);
    },
    [performSave]
  );

  const acceptServerVersion = useCallback((): QuoteDraft | null => {
    if (!conflictDraft) return null;
    applyDraft(conflictDraft);
    setSaveState('SAVED');
    setErrorMessage(null);
    const accepted = conflictDraft;
    setConflictDraft(null);
    return accepted;
  }, [conflictDraft, applyDraft]);

  const overwriteWithMine = useCallback(
    async (payload: DraftPayload) => {
      if (!conflictDraft) return false;
      // 서버 최신 revision 을 기준으로 다시 저장하면 충돌 없이 내 값이 반영된다.
      revisionRef.current = conflictDraft.revision;
      setRevision(conflictDraft.revision);
      setConflictDraft(null);
      return performSave(payload, '충돌 해소 — 이 창의 내용으로 덮어씀');
    },
    [conflictDraft, performSave]
  );

  const markPublished = useCallback(() => {
    clearTimers();
    setActiveDraftId(null);
    if (draftIdRef.current) clearLocalBackup(draftIdRef.current);
  }, []);

  const detach = useCallback(() => {
    clearTimers();
    pendingPayloadRef.current = null;
    setDraftId(null);
    draftIdRef.current = null;
    setRevision(0);
    revisionRef.current = 0;
    setSaveState('IDLE');
    setLastSavedAt(null);
    setErrorMessage(null);
    setConflictDraft(null);
    setPricingChanged(false);
    setActiveDraftId(null);
  }, []);

  const acknowledgePricingChange = useCallback(() => setPricingChanged(false), []);

  // 탭을 닫거나 새로고침할 때, 아직 저장되지 않은 변경은 최소한 로컬에 남긴다.
  useEffect(() => {
    const handler = () => {
      const pending = pendingPayloadRef.current;
      const id = draftIdRef.current;
      if (pending && id) writeLocalBackup(id, pending);
    };
    window.addEventListener('beforeunload', handler);
    return () => {
      window.removeEventListener('beforeunload', handler);
      handler();
      clearTimers();
    };
  }, []);

  return {
    draftId,
    revision,
    saveState,
    lastSavedAt,
    errorMessage,
    conflictDraft,
    pricingChanged,
    createDraft,
    loadDraft,
    scheduleSave,
    saveNow,
    acceptServerVersion,
    overwriteWithMine,
    markPublished,
    detach,
    acknowledgePricingChange,
  };
}
