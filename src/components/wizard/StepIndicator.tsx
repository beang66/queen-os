import React from 'react';

interface StepIndicatorProps {
  currentStep: 1 | 2 | 3;
  onSelectStep?: (step: 1 | 2 | 3) => void;
}

/**
 * 견적서 작성 마법사의 3단계 진행 상태 인디케이터 컴포넌트
 */
export const StepIndicator: React.FC<StepIndicatorProps> = ({ currentStep, onSelectStep }) => {
  const steps = [
    {
      stepNum: 1 as const,
      title: 'AI ORDER EXTRACTION',
      numBadgeColor: 'bg-orange-500 text-white',
    },
    {
      stepNum: 2 as const,
      title: 'DETERMINISTIC CALCULATION',
      numBadgeColor: 'bg-sky-400 text-white',
    },
    {
      stepNum: 3 as const,
      title: 'OFFICIAL QUOTE DOCUMENT',
      numBadgeColor: 'bg-emerald-400 text-white',
    },
  ];

  return (
    <div className="bg-white rounded-xl shadow-xs border border-gray-200/80 p-2 mb-4">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
        {steps.map((item) => {
          const isActive = currentStep === item.stepNum;

          return (
            <button
              key={item.stepNum}
              type="button"
              onClick={() => onSelectStep?.(item.stepNum)}
              className={`flex items-center justify-center gap-2.5 py-2.5 px-4 rounded-lg font-mono text-xs font-bold transition-all ${
                isActive
                  ? 'bg-[#1e293b] text-white shadow-sm'
                  : 'bg-transparent text-gray-400 hover:text-gray-700 hover:bg-gray-50'
              }`}
            >
              <span
                className={`w-4 h-4 rounded-full flex items-center justify-center text-[10px] font-extrabold ${
                  item.numBadgeColor
                }`}
              >
                {item.stepNum}
              </span>
              <span className="tracking-wider uppercase text-[11px]">{item.title}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
};
