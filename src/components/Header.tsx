import React from 'react';
import {
  Calculator,
  Database,
  History,
  Layers as SchemaIcon,
} from 'lucide-react';

interface HeaderProps {
  activeTab: 'wizard' | 'pricing' | 'history' | 'architecture';
  setActiveTab: (tab: 'wizard' | 'pricing' | 'history' | 'architecture') => void;
  pricingCount: number;
  quotesCount: number;
}

export const Header: React.FC<HeaderProps> = ({
  activeTab,
  setActiveTab,
  pricingCount,
  quotesCount,
}) => {
  return (
    <header className="bg-[#1e293b] border-b border-gray-700 text-white sticky top-0 z-40 shadow-sm">
      {/* Top Banner / Brand */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6">
        <div className="flex items-center justify-between h-14">
          {/* Logo & System Title */}
          <div className="flex items-center gap-3">
            <img
              src="/queen-os.png"
              alt="Queen OS"
              className="w-8 h-8 rounded object-cover shadow-sm ring-1 ring-white/10"
            />
            <div className="flex items-baseline gap-2">
              <h1 className="text-base font-bold tracking-tight text-white uppercase">
                QUEEN KITCHEN
              </h1>
              <span className="text-xs font-light text-gray-400 hidden sm:inline font-mono">
                Automated Costing System v2.4
              </span>
            </div>
          </div>

          {/* Quick Metrics & System Status */}
          <div className="flex items-center gap-3 sm:gap-4">
            <span className="flex items-center gap-1.5 text-xs font-semibold text-green-400 bg-gray-900/60 px-2.5 py-1 rounded border border-gray-700/80">
              <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse"></div>
              <span>정상 운영</span>
            </span>

            <div className="hidden md:flex items-center gap-2 text-xs">
              <div className="bg-gray-800 px-2.5 py-1 rounded border border-gray-700 flex items-center gap-1.5">
                <span className="text-[10px] text-gray-400 font-semibold">단가 품목</span>
                <span className="font-mono font-bold text-blue-400">{pricingCount}</span>
              </div>
              <div className="bg-gray-800 px-2.5 py-1 rounded border border-gray-700 flex items-center gap-1.5">
                <span className="text-[10px] text-gray-400 font-semibold">저장 견적</span>
                <span className="font-mono font-bold text-orange-400">{quotesCount}</span>
              </div>
            </div>

            <div className="h-4 w-[1px] bg-gray-600 hidden sm:block"></div>

            <button
              onClick={() => setActiveTab('architecture')}
              className={`text-xs px-2.5 py-1 rounded font-medium transition flex items-center gap-1 border ${
                activeTab === 'architecture'
                  ? 'bg-blue-600 text-white border-blue-500 font-semibold'
                  : 'bg-gray-700 hover:bg-gray-600 text-gray-200 border-gray-600'
              }`}
              title="시스템 구성 및 처리 흐름"
            >
              <SchemaIcon className="w-3.5 h-3.5 text-blue-300" />
              <span className="hidden sm:inline">시스템 설정</span>
            </button>
          </div>
        </div>

        {/* Navigation Tabs - High Density & Compact */}
        <div className="flex space-x-1 border-t border-gray-700/80 pt-1 overflow-x-auto scrollbar-none text-xs">
          <button
            onClick={() => setActiveTab('wizard')}
            className={`flex items-center gap-2 py-2 px-3.5 rounded-t font-semibold text-xs border-b-2 transition whitespace-nowrap ${
              activeTab === 'wizard'
                ? 'border-blue-500 text-white bg-gray-800/90 shadow-inner'
                : 'border-transparent text-gray-400 hover:text-gray-200 hover:bg-gray-800/40'
            }`}
          >
            <Calculator className="w-3.5 h-3.5 text-blue-400" />
            <span>신규 견적</span>
          </button>

          <button
            onClick={() => setActiveTab('history')}
            className={`flex items-center gap-2 py-2 px-3.5 rounded-t font-semibold text-xs border-b-2 transition whitespace-nowrap ${
              activeTab === 'history'
                ? 'border-blue-500 text-white bg-gray-800/90 shadow-inner'
                : 'border-transparent text-gray-400 hover:text-gray-200 hover:bg-gray-800/40'
            }`}
          >
            <History className="w-3.5 h-3.5 text-purple-400" />
            <span>견적 관리</span>
          </button>

          <button
            onClick={() => setActiveTab('pricing')}
            className={`flex items-center gap-2 py-2 px-3.5 rounded-t font-semibold text-xs border-b-2 transition whitespace-nowrap ${
              activeTab === 'pricing'
                ? 'border-blue-500 text-white bg-gray-800/90 shadow-inner'
                : 'border-transparent text-gray-400 hover:text-gray-200 hover:bg-gray-800/40'
            }`}
          >
            <Database className="w-3.5 h-3.5 text-green-400" />
            <span>단가 관리</span>
          </button>
        </div>
      </div>
    </header>
  );
};

