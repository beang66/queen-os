import React, { useState, useEffect } from 'react';
import { StepIndicator } from './wizard/StepIndicator';
import { QuoteStep1Input } from './wizard/QuoteStep1Input';
import { QuoteStep2Calc } from './wizard/QuoteStep2Calc';
import { QuoteStep3Summary } from './wizard/QuoteStep3Summary';
import { OrderEntity, QuoteCalculationResult, QuoteDocument } from '../types';
import { SAMPLE_ORDER_PRESETS } from '../data/samplePresets';

const DEFAULT_ORDER_ENTITY: OrderEntity = {
  customerName: '박지은 고객님',
  contact: '010-3829-1940',
  address: '서울시 서초구 반포대로 120 래미안 104동 802호',
  deliveryDate: '2026-09-20',
  layoutType: 'I_SHAPE',
  dimensions: {
    lowerCabinetLengthMm: 3400,
    upperCabinetLengthMm: 3400,
    islandLengthMm: 0,
    tallCabinetWidthMm: 0,
    fridgeCabinetWidthMm: 1050,
    depthMm: 600,
    heightMm: 850,
    countertopThicknessMm: 12,
  },
  doorOption: {
    material: '한솔 E0 PET 무광 매트 화이트',
    color: '매트 화이트',
    handleType: 'C_CHANNEL',
    edgeFinish: '1.2T 방수 PUR 엣지',
  },
  countertopOption: {
    brand: 'LX 하이막스',
    model: '오로라 비앙코 12T',
    thickness: '12T',
    edgeType: '사각 빗각 가공',
  },
  modules: {
    drawerCount2Tier: 1,
    drawerCount3Tier: 1,
    sinkCabinetCount: 1,
    cooktopCabinetCount: 1,
    spiceRackCount: 1,
    cornerModuleCount: 0,
    riceCookerModuleCount: 0,
  },
  appliances: {
    sinkBowlModel: '백조 그랜드 860 사각싱크볼',
    faucetModel: '더죤테크 슈티에 거위목 수전 (니켈)',
    hoodModel: '하츠 스퀘어 후드 900 (DTR-90S)',
    cooktopModel: 'SK매직 3구 인덕션',
  },
  siteConditions: {
    floor: 8,
    hasElevator: true,
    needsDemolition: true,
    needsLadderTruck: false,
    specialNotes: '8층 엘리베이터 진입 가능, 기존 싱크대 철거 폐기물 수거',
  },
  rawPrompt: SAMPLE_ORDER_PRESETS[0].rawText,
};

interface QuoteWizardProps {
  initialOrderEntity?: OrderEntity | null;
  onSaveQuote: (quote: {
    title: string;
    targetMarginRate: number;
    orderEntity: OrderEntity;
    calculationResult: QuoteCalculationResult;
    notes?: string;
  }) => Promise<QuoteDocument>;
  onNavigateToHistory: () => void;
}

/**
 * 퀸 주방가구 스마트 견적서 작성 마법사 (QuoteWizard) 메인 컨테이너 컴포넌트
 */
export const QuoteWizard: React.FC<QuoteWizardProps> = ({
  initialOrderEntity,
  onSaveQuote,
  onNavigateToHistory,
}) => {
  const [step, setStep] = useState<1 | 2 | 3>(1);

  // Step 1 상태
  const [promptText, setPromptText] = useState<string>(
    initialOrderEntity?.rawPrompt || SAMPLE_ORDER_PRESETS[0].rawText
  );
  const [selectedImage, setSelectedImage] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [aiParsingLoading, setAiParsingLoading] = useState<boolean>(false);
  const [isDragOver, setIsDragOver] = useState<boolean>(false);
  const [extractionSuccessMsg, setExtractionSuccessMsg] = useState<string | null>(null);

  const [orderEntity, setOrderEntity] = useState<OrderEntity>(
    initialOrderEntity || DEFAULT_ORDER_ENTITY
  );

  // 외부 전달 엔티티 변경 동기화
  useEffect(() => {
    if (initialOrderEntity) {
      setOrderEntity(initialOrderEntity);
      if (initialOrderEntity.rawPrompt) {
        setPromptText(initialOrderEntity.rawPrompt);
      }
      setExtractionSuccessMsg(
        `외부에서 전달된 주문 엔티티가 로드되었습니다: ${initialOrderEntity.customerName}`
      );
    }
  }, [initialOrderEntity]);

  // Step 2 원가 계산 & 마진율 상태
  const [targetMarginRate, setTargetMarginRate] = useState<number>(28);
  const [calculationResult, setCalculationResult] = useState<QuoteCalculationResult | null>(null);
  const [calcLoading, setCalcLoading] = useState<boolean>(false);

  // Step 3 최종 견적서 저장 상태
  const [quoteTitle, setQuoteTitle] = useState<string>('서초 래미안 34평형 주방가구 맞춤 제작 및 시공 견적서');
  const [savedQuote, setSavedQuote] = useState<QuoteDocument | null>(null);
  const [saving, setSaving] = useState<boolean>(false);

  // 이미지 드롭 & 파일 선택 핸들러
  const handleImageSelect = (file: File) => {
    setSelectedImage(file);
    const reader = new FileReader();
    reader.onload = () => setImagePreview(reader.result as string);
    reader.readAsDataURL(file);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleImageSelect(e.dataTransfer.files[0]);
    }
  };

  // AI 자연어 & 도면 파싱 요청 API
  const handleParseAiOrder = async () => {
    setAiParsingLoading(true);
    try {
      const res = await fetch('/api/extract-order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: promptText }),
      });
      const data = await res.json();
      if (data.success && data.data) {
        setOrderEntity(data.data);
        setExtractionSuccessMsg('Gemini 3.7 AI 파싱에 성공하여 주문 엔티티가 자동 업데이트되었습니다.');
      } else {
        alert('AI 파싱 실패: ' + (data.error || '알 수 없는 오류'));
      }
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
      const res = await fetch('/api/calculate-quote', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          orderEntity,
          targetMarginRate,
        }),
      });
      const data = await res.json();
      if (data.success && data.data) {
        setCalculationResult(data.data);
      } else {
        alert('원가 계산 실패: ' + (data.error || '계산 오류'));
      }
    } catch (err: any) {
      alert(`원가 산출 오류: ${err.message}`);
    } finally {
      setCalcLoading(false);
    }
  };

  // 마진율 변경 시 실시간 원가 다시 계산
  useEffect(() => {
    if (step === 2 || calculationResult) {
      handleCalculate();
    }
  }, [targetMarginRate]);

  // 최종 견적서 저장 실행
  const handleSaveFinalQuote = async () => {
    if (!calculationResult) return;
    setSaving(true);
    try {
      const result = await onSaveQuote({
        title: quoteTitle,
        targetMarginRate,
        orderEntity,
        calculationResult,
      });
      setSavedQuote(result);
    } catch (err: any) {
      alert(`견적서 저장 실패: ${err.message}`);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* 3단계 진행 인디케이터 */}
      <StepIndicator currentStep={step} onSelectStep={(s) => setStep(s)} />

      {/* Step 1: 입력 & AI 분석 */}
      {step === 1 && (
        <QuoteStep1Input
          orderEntity={orderEntity}
          setOrderEntity={setOrderEntity}
          promptText={promptText}
          setPromptText={setPromptText}
          imagePreview={imagePreview}
          aiParsingLoading={aiParsingLoading}
          isDragOver={isDragOver}
          extractionSuccessMsg={extractionSuccessMsg}
          onImageSelect={handleImageSelect}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onParseAiOrder={handleParseAiOrder}
          onNextStep={() => {
            handleCalculate();
            setStep(2);
          }}
        />
      )}

      {/* Step 2: 실시간 원가 산출 및 마진 설정 */}
      {step === 2 && (
        <QuoteStep2Calc
          orderEntity={orderEntity}
          targetMarginRate={targetMarginRate}
          setTargetMarginRate={setTargetMarginRate}
          calculationResult={calculationResult}
          calcLoading={calcLoading}
          onCalculate={handleCalculate}
          onPrevStep={() => setStep(1)}
          onNextStep={() => setStep(3)}
        />
      )}

      {/* Step 3: 완성된 견적서 양식 및 저장 */}
      {step === 3 && calculationResult && (
        <QuoteStep3Summary
          orderEntity={orderEntity}
          targetMarginRate={targetMarginRate}
          calculationResult={calculationResult}
          quoteTitle={quoteTitle}
          setQuoteTitle={setQuoteTitle}
          savedQuote={savedQuote}
          saving={saving}
          onSaveQuote={handleSaveFinalQuote}
          onPrevStep={() => setStep(2)}
          onNavigateToHistory={onNavigateToHistory}
        />
      )}
    </div>
  );
};
