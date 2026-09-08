import React, { useState, useEffect, useRef, useCallback } from 'react';
import { FilePlus2, History as HistoryIcon, Loader2 } from 'lucide-react';
import { StepIndicator, WizardStep } from './wizard/StepIndicator';
import { QuoteStep1Input } from './wizard/QuoteStep1Input';
import { QuoteStep2Review } from './wizard/QuoteStep2Review';
import { QuoteStep2Calc } from './wizard/QuoteStep2Calc';
import { QuoteStep3Summary } from './wizard/QuoteStep3Summary';
import { DraftStatusBar } from './wizard/DraftStatusBar';
import {
  DraftPayload,
  OrderEntity,
  PricingItem,
  QuoteCalculationResult,
  QuoteDocument,
  QuoteDraftSummary,
  QuotePublishMeta,
  ReviewLineItem,
} from '../types';
import { SAMPLE_ORDER_PRESETS } from '../data/samplePresets';
import { PRESET_ORDER_ENTITIES } from '../data/presetOrderEntities';
import { AttachedFile, buildReviewItems } from './wizard/review/reviewModel';
import { fetchJson } from '../lib/api';
import { getActiveDraftId, useQuoteDraft } from '../hooks/useQuoteDraft';

const DEFAULT_ORDER_ENTITY: OrderEntity = PRESET_ORDER_ENTITIES[0];
const DEFAULT_QUOTE_TITLE = '서초 래미안 34평형 주방가구 맞춤 제작 및 시공 견적서';
const DEFAULT_PUBLISH_META: QuotePublishMeta = {
  validUntilDays: 15,
  paymentTerms: '계약금 30% / 제작 착수금 40% / 설치 완료 후 잔금 30%',
  exclusions: '전기 증설, 배관 이설, 타일·도배 등 주방 외 공사는 별도입니다.',
  specialTerms: '실측 후 치수 변경 시 견적 금액이 조정될 수 있습니다.',
  internalMemo: '',
  hiddenBreakdownIds: [],
};

const STEP_LABELS: Record<number, string> = {
  1: '자료 입력',
  2: '규격 검수',
  3: '원가 계산',
  4: '견적서 발행',
};

interface QuoteWizardProps {
  initialOrderEntity?: OrderEntity | null;
  /** 규격 검수 단계에서 품목-단가 DB 연결에 사용 */
  pricingItems?: PricingItem[];
  onSaveQuote: (quote: {
    title: string;
    targetMarginRate: number;
    orderEntity: OrderEntity;
    calculationResult: QuoteCalculationResult;
    notes?: string;
    quoteNumber?: string;
    version?: number;
    parentQuoteId?: string;
    publishMeta?: QuotePublishMeta;
    draftId?: string;
  }) => Promise<QuoteDocument>;
  onNavigateToHistory: () => void;
  /** 견적 관리 화면에서 "이어서 작성"으로 넘어온 초안 id */
  resumeDraftId?: string | null;
  onResumeHandled?: () => void;
}

/**
 * 퀸 주방가구 스마트 견적서 작성 마법사 (QuoteWizard) 메인 컨테이너 컴포넌트
 *
 * 작성을 시작하는 순간 견적 초안이 만들어지고, 이후 모든 단계의 변경사항은
 * 같은 초안 id 로 자동 저장됩니다. 다른 메뉴에 다녀와도 같은 초안이 복원됩니다.
 */
export const QuoteWizard: React.FC<QuoteWizardProps> = ({
  initialOrderEntity,
  pricingItems = [],
  onSaveQuote,
  onNavigateToHistory,
  resumeDraftId = null,
  onResumeHandled,
}) => {
  const [step, setStep] = useState<WizardStep>(1);

  // Step 1 상태
  const [promptText, setPromptText] = useState<string>(
    initialOrderEntity?.rawPrompt || SAMPLE_ORDER_PRESETS[0].rawText
  );
  const [aiParsingLoading, setAiParsingLoading] = useState<boolean>(false);
  const [extractionSuccessMsg, setExtractionSuccessMsg] = useState<string | null>(null);
  // AI 정보 추출을 한 번이라도 성공했는지 (1단계 하단 버튼 문구 결정)
  const [aiExtracted, setAiExtracted] = useState<boolean>(false);
  const [attachedFiles, setAttachedFiles] = useState<AttachedFile[]>([]);

  const [orderEntity, setOrderEntity] = useState<OrderEntity>(
    initialOrderEntity || DEFAULT_ORDER_ENTITY
  );

  // 규격 검수용 주방 구성 품목 (1·2단계 공유)
  const [reviewItems, setReviewItems] = useState<ReviewLineItem[]>(() =>
    buildReviewItems(initialOrderEntity || DEFAULT_ORDER_ENTITY)
  );

  // Step 3 원가 계산 & 마진율 상태
  const [targetMarginRate, setTargetMarginRate] = useState<number>(28);
  const [calculationResult, setCalculationResult] = useState<QuoteCalculationResult | null>(null);
  const [calcLoading, setCalcLoading] = useState<boolean>(false);
  // 마지막 계산 이후 입력(주문 정보·품목)이 바뀌었는지 여부
  const [calcDirty, setCalcDirty] = useState<boolean>(false);

  // Step 4 견적서 발행 상태
  const [quoteTitle, setQuoteTitle] = useState<string>(DEFAULT_QUOTE_TITLE);
  const [savedQuote, setSavedQuote] = useState<QuoteDocument | null>(null);
  const [saving, setSaving] = useState<boolean>(false);
  // 발행된 버전 이력 (V1, V2, V3 ...) 및 발행 메타데이터
  const [publishedVersions, setPublishedVersions] = useState<QuoteDocument[]>([]);
  const [publishMeta, setPublishMeta] = useState<QuotePublishMeta>(DEFAULT_PUBLISH_META);

  // ---- 초안(Draft) 연동 --------------------------------------------------
  const draft = useQuoteDraft();
  const [booting, setBooting] = useState<boolean>(true);
  /** 초안 복원이 끝나기 전에는 자동 저장을 걸지 않는다 (복원값으로 덮어쓰는 것을 방지) */
  const hydratedRef = useRef<boolean>(false);
  /** 진행 중인 다른 초안 안내 목록 */
  const [otherDrafts, setOtherDrafts] = useState<QuoteDraftSummary[]>([]);
  const [resumedNotice, setResumedNotice] = useState<string | null>(null);

  const buildPayload = useCallback(
    (): DraftPayload => ({
      step,
      promptText,
      // base64 미리보기는 용량이 커서 저장하지 않는다 (파일 목록만 복원)
      attachedFiles: attachedFiles.map(({ id, name, sizeLabel, uploadedAt, kind }) => ({
        id,
        name,
        sizeLabel,
        uploadedAt,
        kind,
      })),
      orderEntity,
      reviewItems,
      targetMarginRate,
      calculationResult,
      quoteTitle,
      publishMeta,
    }),
    [step, promptText, attachedFiles, orderEntity, reviewItems, targetMarginRate, calculationResult, quoteTitle, publishMeta]
  );

  /** 서버에서 받은 초안 내용을 화면 상태로 되돌린다. */
  const applyPayload = useCallback((payload: DraftPayload) => {
    hydratedRef.current = false;
    setStep((payload.step ?? 1) as WizardStep);
    setPromptText(payload.promptText ?? '');
    setAttachedFiles((payload.attachedFiles ?? []).map((f) => ({ ...f, previewUrl: null })));
    setOrderEntity(payload.orderEntity ?? DEFAULT_ORDER_ENTITY);
    setReviewItems(payload.reviewItems ?? []);
    setTargetMarginRate(payload.targetMarginRate ?? 28);
    setCalculationResult(payload.calculationResult ?? null);
    setQuoteTitle(payload.quoteTitle || DEFAULT_QUOTE_TITLE);
    setPublishMeta(payload.publishMeta ?? DEFAULT_PUBLISH_META);
    setSavedQuote(null);
    setCalcDirty(false);
  }, []);

  /** 마법사 상태를 초기값으로 되돌린다 (새 견적 시작용). */
  const resetToDefaults = useCallback(() => {
    hydratedRef.current = false;
    setStep(1);
    setPromptText(SAMPLE_ORDER_PRESETS[0].rawText);
    setAttachedFiles([]);
    setOrderEntity(DEFAULT_ORDER_ENTITY);
    setReviewItems(buildReviewItems(DEFAULT_ORDER_ENTITY));
    setTargetMarginRate(28);
    setCalculationResult(null);
    setQuoteTitle(DEFAULT_QUOTE_TITLE);
    setPublishMeta(DEFAULT_PUBLISH_META);
    setSavedQuote(null);
    setPublishedVersions([]);
    setAiExtracted(false);
    setExtractionSuccessMsg(null);
    setCalcDirty(false);
  }, []);

  // 최초 진입: 진행 중이던 초안을 복원하거나, 없으면 새 초안을 만든다.
  useEffect(() => {
    let cancelled = false;

    const boot = async () => {
      // 견적 관리에서 "이어서 작성"으로 지정한 초안이 최우선
      const targetId = resumeDraftId || getActiveDraftId();

      if (targetId) {
        const loaded = await draft.loadDraft(targetId);
        if (cancelled) return;
        if (loaded) {
          applyPayload(loaded.payload);
          setResumedNotice(
            `진행 중이던 초안을 이어서 작성합니다 (${STEP_LABELS[loaded.payload.step] ?? '자료 입력'} 단계, rev.${loaded.revision}).`
          );
          hydratedRef.current = true;
          setBooting(false);
          onResumeHandled?.();
          return;
        }
      }

      // 진행 중인 다른 초안이 있으면 안내한다.
      try {
        const list = await fetchJson<{ data: QuoteDraftSummary[] }>('/api/drafts?status=ACTIVE');
        if (!cancelled) setOtherDrafts(list.data.slice(0, 5));
      } catch {
        /* 목록 조회 실패는 치명적이지 않으므로 무시 */
      }

      if (cancelled) return;
      await draft.createDraft({
        step: 1,
        promptText: SAMPLE_ORDER_PRESETS[0].rawText,
        attachedFiles: [],
        orderEntity: initialOrderEntity || DEFAULT_ORDER_ENTITY,
        reviewItems: buildReviewItems(initialOrderEntity || DEFAULT_ORDER_ENTITY),
        targetMarginRate: 28,
        calculationResult: null,
        quoteTitle: DEFAULT_QUOTE_TITLE,
        publishMeta: DEFAULT_PUBLISH_META,
      });
      if (cancelled) return;
      hydratedRef.current = true;
      setBooting(false);
      onResumeHandled?.();
    };

    void boot();
    return () => {
      cancelled = true;
    };
    // 최초 1회만 실행한다.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 입력 변경 감지 → 자동 저장 예약
  useEffect(() => {
    if (!hydratedRef.current || !draft.draftId) return;
    draft.scheduleSave(buildPayload());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [buildPayload, draft.draftId]);

  // 실제 주문 사례 프리셋 불러오기
  const handleLoadPreset = (index: number) => {
    const preset = PRESET_ORDER_ENTITIES[index];
    if (!preset) return;
    setOrderEntity(preset);
    setReviewItems(buildReviewItems(preset));
    setPromptText(SAMPLE_ORDER_PRESETS[index].rawText);
  };

  // 외부 전달 엔티티 변경 동기화
  useEffect(() => {
    if (initialOrderEntity) {
      setOrderEntity(initialOrderEntity);
      setReviewItems(buildReviewItems(initialOrderEntity));
      if (initialOrderEntity.rawPrompt) {
        setPromptText(initialOrderEntity.rawPrompt);
      }
      setExtractionSuccessMsg(
        `외부에서 전달된 주문 엔티티가 로드되었습니다: ${initialOrderEntity.customerName}`
      );
    }
  }, [initialOrderEntity]);

  // AI 자연어 & 도면 파싱 요청 API
  const handleParseAiOrder = async () => {
    setAiParsingLoading(true);
    try {
      const data = await fetchJson<{ data: OrderEntity }>('/api/gemini/parse-order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: promptText }),
      });
      // 추출값을 기존 엔티티에 병합해 사용자가 이미 확인한 값이 지워지지 않도록 함
      const merged: OrderEntity = { ...orderEntity, ...data.data };
      setOrderEntity(merged);
      setReviewItems(buildReviewItems(merged));
      setAiExtracted(true);
      setExtractionSuccessMsg('AI 정보 추출이 완료되었습니다. 오른쪽 요약을 확인한 뒤 규격 검수로 이동하세요.');
    } catch (err: any) {
      alert(`AI 파싱 오류: ${err.message}`);
    } finally {
      setAiParsingLoading(false);
    }
  };

  // 백엔드 결정론적 원가 산출 엔진 호출 API
  const handleCalculate = async () => {
    setCalcLoading(true);
    try {
      const data = await fetchJson<{ data: QuoteCalculationResult }>('/api/quote/calculate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderEntity }),
      });
      setCalculationResult(data.data);
      setCalcDirty(false);
      draft.acknowledgePricingChange();
    } catch (err: any) {
      alert(`원가 산출 오류: ${err.message}`);
    } finally {
      setCalcLoading(false);
    }
  };

  // 마진율 변경 시 실시간 원가 다시 계산
  useEffect(() => {
    if (step === 3 || calculationResult) {
      handleCalculate();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [targetMarginRate]);

  // 계산 이후 주문 정보·품목이 바뀌면 "다시 계산" 안내를 위해 dirty 표시
  useEffect(() => {
    if (calculationResult) {
      setCalcDirty(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orderEntity, reviewItems]);

  // 견적서 발행 실행 (V1) 및 새 버전 발행 (V2, V3 ...)
  const handleSaveFinalQuote = async () => {
    if (!calculationResult) return;
    setSaving(true);
    try {
      // 발행 직전 최신 상태를 초안에 확정 저장한다.
      await draft.saveNow(buildPayload(), '견적서 발행 직전 저장');

      const rootQuote = publishedVersions[0] ?? null;
      const nextVersion = publishedVersions.length + 1;
      const baseNumber = rootQuote
        ? rootQuote.quoteNumber.replace(/-V\d+$/, '')
        : undefined;

      const result = await onSaveQuote({
        title: nextVersion > 1 ? `${quoteTitle} (V${nextVersion})` : quoteTitle,
        targetMarginRate,
        orderEntity,
        calculationResult,
        notes: publishMeta.specialTerms,
        version: nextVersion,
        parentQuoteId: rootQuote?.id,
        quoteNumber: baseNumber ? `${baseNumber}-V${nextVersion}` : undefined,
        publishMeta,
        draftId: draft.draftId ?? undefined,
      });
      setSavedQuote(result);
      setPublishedVersions((prev) => [...prev, result]);
      draft.markPublished();
    } catch (err: any) {
      alert(`견적서 발행 실패: ${err.message}`);
    } finally {
      setSaving(false);
    }
  };

  // 발행 완료 후 "새 버전으로 수정" — 기존 문서를 덮어쓰지 않고 편집 모드로 복귀
  const handleStartNewVersion = () => {
    setSavedQuote(null);
  };

  /** 현재 초안을 두고 완전히 새로운 견적을 시작한다. */
  const handleStartNewDraft = async () => {
    if (!confirm('지금 작성 중인 초안은 그대로 보관하고, 새 견적을 시작할까요?')) return;
    draft.detach();
    resetToDefaults();
    setResumedNotice(null);
    await draft.createDraft({
      step: 1,
      promptText: SAMPLE_ORDER_PRESETS[0].rawText,
      attachedFiles: [],
      orderEntity: DEFAULT_ORDER_ENTITY,
      reviewItems: buildReviewItems(DEFAULT_ORDER_ENTITY),
      targetMarginRate: 28,
      calculationResult: null,
      quoteTitle: DEFAULT_QUOTE_TITLE,
      publishMeta: DEFAULT_PUBLISH_META,
    });
    hydratedRef.current = true;
  };

  /** 안내 목록에서 다른 초안을 이어서 작성한다. */
  const handleResumeOther = async (id: string) => {
    const loaded = await draft.loadDraft(id);
    if (!loaded) return;
    applyPayload(loaded.payload);
    setOtherDrafts([]);
    setResumedNotice(
      `초안을 이어서 작성합니다 (${STEP_LABELS[loaded.payload.step] ?? '자료 입력'} 단계, rev.${loaded.revision}).`
    );
    hydratedRef.current = true;
  };

  /** 단계별 [임시 저장] — 현재 상태를 초안으로 즉시 서버 저장 */
  const handleTempSave = useCallback(() => {
    void draft.saveNow(buildPayload());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [buildPayload, draft.saveNow]);

  const tempSaving = draft.saveState === 'SAVING';

  /** 충돌 해소 — 서버 최신본을 화면에 반영 */
  const handleAcceptServer = () => {
    const accepted = draft.acceptServerVersion();
    if (accepted) {
      applyPayload(accepted.payload);
      hydratedRef.current = true;
    }
  };

  if (booting) {
    return (
      <div className="bg-white rounded-xl border border-gray-200 p-10 flex flex-col items-center gap-3 text-sm text-gray-500">
        <Loader2 className="w-6 h-6 animate-spin text-blue-500" />
        견적 초안을 준비하고 있습니다...
      </div>
    );
  }

  return (
    <div className="w-full space-y-4">
      {/* 초안 저장 상태 · 충돌 · 단가 변경 안내 */}
      <DraftStatusBar
        draftId={draft.draftId}
        revision={draft.revision}
        saveState={draft.saveState}
        lastSavedAt={draft.lastSavedAt}
        errorMessage={draft.errorMessage}
        conflictDraft={draft.conflictDraft}
        pricingChanged={draft.pricingChanged}
        onSaveNow={() => void draft.saveNow(buildPayload())}
        onAcceptServer={handleAcceptServer}
        onOverwriteMine={() => void draft.overwriteWithMine(buildPayload())}
        onRecalculate={() => void handleCalculate()}
        onDismissPricingChange={draft.acknowledgePricingChange}
      />

      {/* 진행 중인 다른 초안 안내 */}
      {otherDrafts.length > 0 && (
        <div className="bg-white rounded-xl border border-blue-200 p-3 shadow-xs space-y-2">
          <div className="flex items-center justify-between gap-2">
            <p className="text-xs font-bold text-gray-800 flex items-center gap-1.5">
              <HistoryIcon className="w-4 h-4 text-blue-500" />
              진행 중인 초안이 {otherDrafts.length}건 있습니다
            </p>
            <button
              type="button"
              onClick={() => setOtherDrafts([])}
              className="text-[11px] font-semibold text-gray-400 hover:text-gray-600"
            >
              새 견적으로 계속
            </button>
          </div>
          <ul className="space-y-1">
            {otherDrafts.map((d) => (
              <li key={d.id}>
                <button
                  type="button"
                  onClick={() => void handleResumeOther(d.id)}
                  className="w-full text-left rounded-lg border border-gray-100 hover:border-blue-300 hover:bg-blue-50/40 px-2.5 py-2 transition-colors flex items-center justify-between gap-2"
                >
                  <span className="min-w-0">
                    <span className="text-xs font-bold text-gray-800 block truncate">
                      {d.customerName || '고객 미지정'}
                      {d.projectName ? ` · ${d.projectName}` : ''}
                    </span>
                    <span className="text-[11px] text-gray-500">
                      {STEP_LABELS[d.step]} 단계 · 품목 {d.itemCount}건 · rev.{d.revision}
                    </span>
                  </span>
                  <span className="text-[11px] font-mono text-gray-400 shrink-0">
                    {new Date(d.updatedAt).toLocaleString('ko-KR', { hour12: false }).slice(5, 17)}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* 4단계 진행 인디케이터: 자료 입력 → 규격 검수 → 원가 계산 → 견적서 발행 */}
      <StepIndicator currentStep={step} onSelectStep={(s) => setStep(s)} />

      {resumedNotice && (
        <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg text-blue-800 text-xs flex items-center justify-between gap-3">
          <span>{resumedNotice}</span>
          <button
            type="button"
            onClick={() => void handleStartNewDraft()}
            className="shrink-0 flex items-center gap-1.5 border border-blue-300 bg-white hover:bg-blue-100 text-blue-800 font-bold px-2.5 py-1.5 rounded-lg transition-colors"
          >
            <FilePlus2 className="w-3.5 h-3.5" />
            새 견적 시작
          </button>
        </div>
      )}

      {extractionSuccessMsg && (
        <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-lg text-emerald-800 text-xs">
          {extractionSuccessMsg}
        </div>
      )}

      {/* Step 1: 자료 입력 (도면·메모·사진 업로드, AI 정보 추출) — 입력 전용 */}
      {step === 1 && (
        <QuoteStep1Input
          orderEntity={orderEntity}
          promptText={promptText}
          setPromptText={setPromptText}
          attachedFiles={attachedFiles}
          setAttachedFiles={setAttachedFiles}
          reviewItems={reviewItems}
          aiParsingLoading={aiParsingLoading}
          aiExtracted={aiExtracted}
          onTempSave={handleTempSave}
          tempSaving={tempSaving}
          lastSavedAt={draft.lastSavedAt}
          onLoadPreset={handleLoadPreset}
          onParseAiOrder={handleParseAiOrder}
          onNextStep={() => setStep(2)}
        />
      )}

      {/* Step 2: 규격 검수 (주문 정보 정밀 검토, 품목 확정, 단가 DB 연결) */}
      {step === 2 && (
        <QuoteStep2Review
          orderEntity={orderEntity}
          setOrderEntity={setOrderEntity}
          items={reviewItems}
          setItems={setReviewItems}
          pricingItems={pricingItems}
          promptText={promptText}
          onTempSave={handleTempSave}
          tempSaving={tempSaving}
          lastSavedAt={draft.lastSavedAt}
          onPrevStep={() => setStep(1)}
          onNextStep={() => {
            handleCalculate();
            setStep(3);
          }}
        />
      )}

      {/* Step 3: 원가 계산 (품목별 단가 산출 및 마진율 시뮬레이션) */}
      {step === 3 && (
        <QuoteStep2Calc
          orderEntity={orderEntity}
          targetMarginRate={targetMarginRate}
          setTargetMarginRate={setTargetMarginRate}
          calculationResult={calculationResult}
          calcLoading={calcLoading}
          calcDirty={calcDirty}
          onCalculate={handleCalculate}
          onPrevStep={() => setStep(2)}
          onNextStep={() => setStep(4)}
        />
      )}

      {/* Step 4: 견적서 발행 (최종 견적 문서 생성·저장·내보내기) */}
      {step === 4 && (
        calculationResult ? (
          <QuoteStep3Summary
            orderEntity={orderEntity}
            calculationResult={calculationResult}
            targetMarginRate={targetMarginRate}
            quoteTitle={quoteTitle}
            setQuoteTitle={setQuoteTitle}
            publishMeta={publishMeta}
            setPublishMeta={setPublishMeta}
            savedQuote={savedQuote}
            publishedVersions={publishedVersions}
            saving={saving}
            onTempSave={handleTempSave}
            tempSaving={tempSaving}
            lastSavedAt={draft.lastSavedAt}
            onSaveQuote={handleSaveFinalQuote}
            onStartNewVersion={handleStartNewVersion}
            onPrevStep={() => setStep(3)}
            onNavigateToHistory={onNavigateToHistory}
          />
        ) : (
          <div className="bg-white rounded-xl p-8 text-center border border-gray-200">
            <p className="text-sm text-gray-500 mb-3">견적서 계산 결과가 아직 생성되지 않았습니다.</p>
            <button
              type="button"
              onClick={() => {
                handleCalculate();
                setStep(3);
              }}
              className="bg-blue-600 text-white text-xs font-semibold px-4 py-2 rounded-lg"
            >
              원가 계산으로 이동
            </button>
          </div>
        )
      )}
    </div>
  );
};
