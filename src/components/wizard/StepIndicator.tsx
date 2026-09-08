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
    <div className="flex items-stretch gap-1.5 mb-4">
      {steps.map((item, idx) => {
        const isActive = currentStep === item.stepNum;
        const isDone = currentStep > item.stepNum;

        return (
          <React.Fragment key={item.stepNum}>
            <button
              type="button"
              onClick={() => onSelectStep?.(item.stepNum)}
              className={`flex-1 flex items-center gap-3 py-3 px-4 rounded-xl border text-left transition-all ${
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
              <div className="flex items-center">
                <ChevronRight className="w-4 h-4 text-gray-300" />
              </div>
            )}
          </React.Fragment>
        );
      })}
    </div>
  );
};
