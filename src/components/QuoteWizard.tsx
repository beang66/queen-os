import React, { useState, useEffect } from 'react';
import { StepIndicator, WizardStep } from './wizard/StepIndicator';
import { QuoteStep1Input } from './wizard/QuoteStep1Input';
import { QuoteStep2Review } from './wizard/QuoteStep2Review';
import { QuoteStep2Calc } from './wizard/QuoteStep2Calc';
import { QuoteStep3Summary } from './wizard/QuoteStep3Summary';
import { OrderEntity, PricingItem, QuoteCalculationResult, QuoteDocument, QuotePublishMeta, ReviewLineItem } from '../types';
import { SAMPLE_ORDER_PRESETS } from '../data/samplePresets';
import { PRESET_ORDER_ENTITIES } from '../data/presetOrderEntities';
import { AttachedFile, buildReviewItems } from './wizard/review/reviewModel';
import { fetchJson } from '../lib/api';

const DEFAULT_ORDER_ENTITY: OrderEntity = PRESET_ORDER_ENTITIES[0];

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
  }) => Promise<QuoteDocument>;
  onNavigateToHistory: () => void;
}

/**
 * 퀸 주방가구 스마트 견적서 작성 마법사 (QuoteWizard) 메인 컨테이너 컴포넌트
 */
export const QuoteWizard: React.FC<QuoteWizardProps> = ({
  initialOrderEntity,
  pricingItems = [],
  onSaveQuote,
  onNavigateToHistory,
}) => {
  const [step, setStep] = useState<WizardStep>(1);

  // Step 1 상태
  const [promptText, setPromptText] = useState<string>(
    initialOrderEntity?.rawPrompt || SAMPLE_ORDER_PRESETS[0].rawText
  );
  const [aiParsingLoading, setAiParsingLoading] = useState<boolean>(false);
  const [extractionSuccessMsg, setExtractionSuccessMsg] = useState<string | null>(null);
  const [attachedFiles, setAttachedFiles] = useState<AttachedFile[]>([]);

  const [orderEntity, setOrderEntity] = useState<OrderEntity>(
    initialOrderEntity || DEFAULT_ORDER_ENTITY
  );

  // 규격 검수용 주방 구성 품목 (1·2단계 공유)
  const [reviewItems, setReviewItems] = useState<ReviewLineItem[]>(() =>
    buildReviewItems(initialOrderEntity || DEFAULT_ORDER_ENTITY)
  );

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

  // Step 3 원가 계산 & 마진율 상태
  const [targetMarginRate, setTargetMarginRate] = useState<number>(28);
  const [calculationResult, setCalculationResult] = useState<QuoteCalculationResult | null>(null);
  const [calcLoading, setCalcLoading] = useState<boolean>(false);
  // 마지막 계산 이후 입력(주문 정보·품목)이 바뀌었는지 여부
  const [calcDirty, setCalcDirty] = useState<boolean>(false);

  // Step 4 견적서 발행 상태
  const [quoteTitle, setQuoteTitle] = useState<string>('서초 래미안 34평형 주방가구 맞춤 제작 및 시공 견적서');
  const [savedQuote, setSavedQuote] = useState<QuoteDocument | null>(null);
  const [saving, setSaving] = useState<boolean>(false);
  // 발행된 버전 이력 (V1, V2, V3 ...) 및 발행 메타데이터
  const [publishedVersions, setPublishedVersions] = useState<QuoteDocument[]>([]);
  const [publishMeta, setPublishMeta] = useState<QuotePublishMeta>({
    validUntilDays: 15,
    paymentTerms: '계약금 30% / 제작 착수금 40% / 설치 완료 후 잔금 30%',
    exclusions: '전기 증설, 배관 이설, 타일·도배 등 주방 외 공사는 별도입니다.',
    specialTerms: '실측 후 치수 변경 시 견적 금액이 조정될 수 있습니다.',
    internalMemo: '',
    hiddenBreakdownIds: [],
  });

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
      setExtractionSuccessMsg('AI 정보 추출이 완료되었습니다. 오른쪽에서 추출 결과를 검수하세요.');
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
      });
      setSavedQuote(result);
      setPublishedVersions((prev) => [...prev, result]);
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

  return (
    <div className="w-full space-y-4">
      {/* 4단계 진행 인디케이터: 자료 입력 → 규격 검수 → 원가 계산 → 견적서 발행 */}
      <StepIndicator currentStep={step} onSelectStep={(s) => setStep(s)} />

      {extractionSuccessMsg && (
        <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-lg text-emerald-800 text-xs">
          {extractionSuccessMsg}
        </div>
      )}

      {/* Step 1: 자료 입력 (도면·메모·사진 업로드, AI 정보 추출, 추출 결과 검수) */}
      {step === 1 && (
        <QuoteStep1Input
          orderEntity={orderEntity}
          setOrderEntity={setOrderEntity}
          promptText={promptText}
          setPromptText={setPromptText}
          attachedFiles={attachedFiles}
          setAttachedFiles={setAttachedFiles}
          reviewItems={reviewItems}
          setReviewItems={setReviewItems}
          pricingItems={pricingItems}
          aiParsingLoading={aiParsingLoading}
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
