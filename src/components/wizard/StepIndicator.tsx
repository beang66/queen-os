import React from 'react';
import { ChevronRight } from 'lucide-react';

export type WizardStep = 1 | 2 | 3 | 4;

interface StepIndicatorProps {
  currentStep: WizardStep;
  onSelectStep?: (step: WizardStep) => void;
}

/**
 * 견적서 작성 마법사의 4단계 진행 상태 인디케이터 컴포넌트
 * 1. 자료 입력 → 2. 규격 검수 → 3. 원가 계산 → 4. 견적서 발행
 */
export const StepIndicator: React.FC<StepIndicatorProps> = ({ currentStep, onSelectStep }) => {
  const steps = [
    {
      stepNum: 1 as const,
      title: '자료 입력',
      description: '상담 자료 업로드 및 기본 정보 입력',
    },
    {
      stepNum: 2 as const,
      title: '규격 검수',
      description: '추출된 정보 검토 및 수정',
    },
    {
      stepNum: 3 as const,
      title: '원가 계산',
      description: '품목별 단가 산출',
    },
    {
      stepNum: 4 as const,
      title: '견적서 발행',
      description: '견적서 생성 및 내보내기',
    },
  ];

  return (
    <section aria-labelledby="wizard-progress-heading" className="wizard-progress bg-white rounded-xl border border-gray-200 p-3 sm:p-4 mb-4">
      <div className="flex items-start justify-between gap-4 mb-3">
        <div>
          <p className="text-[11px] font-bold text-emerald-700 mb-1">견적 작성 · {currentStep}/4단계</p>
          <h1 id="wizard-progress-heading" className="text-base font-bold text-gray-900">{steps[currentStep - 1].title}</h1>
          <p className="text-xs text-gray-500 mt-0.5">{steps[currentStep - 1].description}</p>
        </div>
        <p className="hidden sm:block text-[11px] text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-2.5 py-2 max-w-xs">
          발행 전 규격과 계산 결과를 반드시 사람이 확인하세요.
        </p>
      </div>
      <div className="wizard-stage-list flex items-stretch gap-1.5" role="list" aria-label="견적 작성 단계">
      {steps.map((item, idx) => {
        const isActive = currentStep === item.stepNum;
        const isDone = currentStep > item.stepNum;

        return (
          <React.Fragment key={item.stepNum}>
            <button
              type="button"
              onClick={() => onSelectStep?.(item.stepNum)}
              aria-current={isActive ? 'step' : undefined}
              aria-label={`${item.stepNum}단계 ${item.title}${isDone ? ', 완료' : isActive ? ', 현재 단계' : ''}`}
              role="listitem"
              className={`wizard-stage flex-1 flex items-center gap-3 py-3 px-4 rounded-xl border text-left transition-all ${
                isActive
                  ? 'bg-[#1e293b] border-[#1e293b] text-white shadow-sm'
                  : isDone
                  ? 'bg-white border-gray-200 text-gray-700 hover:border-blue-300'
                  : 'bg-white border-gray-200/80 text-gray-400 hover:border-gray-300'
              }`}
            >
              <span
                className={`w-7 h-7 shrink-0 rounded-full flex items-center justify-center text-xs font-bold ${
                  isActive
                    ? 'bg-blue-500 text-white'
                    : isDone
                    ? 'bg-emerald-500 text-white'
                    : 'bg-gray-100 text-gray-400'
                }`}
              >
                {item.stepNum}
              </span>
              <span className="min-w-0">
                <span
                  className={`block text-[13px] font-bold leading-tight ${
                    isActive ? 'text-white' : isDone ? 'text-gray-800' : 'text-gray-500'
                  }`}
                >
                  {item.title}
                </span>
                <span
                  className={`block text-[11px] leading-tight mt-0.5 truncate ${
                    isActive ? 'text-slate-300' : 'text-gray-400'
                  }`}
                >
                  {item.description}
                </span>
              </span>
            </button>

            {idx < steps.length - 1 && (
              <div className="wizard-stage-chevron flex items-center" aria-hidden="true">
                <ChevronRight className="w-4 h-4 text-gray-300" />
              </div>
            )}
          </React.Fragment>
        );
      })}
      </div>
    </section>
  );
};
