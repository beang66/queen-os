import React from 'react';
import {
  Calculator,
  Database,
  History,
  Layers,
  Sparkles,
  Layers as SchemaIcon,
} from 'lucide-react';

interface HeaderProps {
  activeTab: 'wizard' | 'extract' | 'pricing' | 'history' | 'architecture';
  setActiveTab: (tab: 'wizard' | 'extract' | 'pricing' | 'history' | 'architecture') => void;
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
            <div className="w-8 h-8 bg-orange-500 rounded flex items-center justify-center font-bold text-lg text-white shadow-sm">
              Q
            </div>
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
            <span className="flex items-center gap-1.5 text-xs text-green-400 font-mono bg-gray-900/60 px-2.5 py-1 rounded border border-gray-700/80">
              <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse"></div>
              <span>SYSTEM ONLINE</span>
            </span>

            <div className="hidden md:flex items-center gap-2 font-mono text-xs">
              <div className="bg-gray-800 px-2.5 py-1 rounded border border-gray-700 flex items-center gap-1.5">
                <span className="text-[10px] text-gray-400 uppercase font-semibold">DB Items:</span>
                <span className="font-bold text-blue-400">{pricingCount}</span>
              </div>
              <div className="bg-gray-800 px-2.5 py-1 rounded border border-gray-700 flex items-center gap-1.5">
                <span className="text-[10px] text-gray-400 uppercase font-semibold">Quotes:</span>
                <span className="font-bold text-orange-400">{quotesCount}</span>
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
              title="시스템 처리 흐름도 및 파이프라인"
            >
              <SchemaIcon className="w-3.5 h-3.5 text-blue-300" />
              <span className="hidden sm:inline">ARCHITECTURE</span>
            </button>
          </div>
        </div>

        {/* Navigation Tabs - High Density & Compact */}
        <div className="flex space-x-1 border-t border-gray-700/80 pt-1 overflow-x-auto scrollbar-none text-xs font-mono">
          <button
            onClick={() => setActiveTab('wizard')}
            className={`flex items-center gap-2 py-2 px-3.5 rounded-t font-semibold text-xs border-b-2 transition whitespace-nowrap uppercase tracking-wider ${
              activeTab === 'wizard'
                ? 'border-blue-500 text-white bg-gray-800/90 shadow-inner'
                : 'border-transparent text-gray-400 hover:text-gray-200 hover:bg-gray-800/40'
            }`}
          >
            <Calculator className="w-3.5 h-3.5 text-blue-400" />
            <span>1. Quote Engine (신규 견적)</span>
          </button>

          <button
            onClick={() => setActiveTab('pricing')}
            className={`flex items-center gap-2 py-2 px-3.5 rounded-t font-semibold text-xs border-b-2 transition whitespace-nowrap uppercase tracking-wider ${
              activeTab === 'pricing'
                ? 'border-blue-500 text-white bg-gray-800/90 shadow-inner'
                : 'border-transparent text-gray-400 hover:text-gray-200 hover:bg-gray-800/40'
            }`}
          >
            <Database className="w-3.5 h-3.5 text-green-400" />
            <span>2. Pricing DB (단가표 관리)</span>
          </button>

          <button
            onClick={() => setActiveTab('history')}
            className={`flex items-center gap-2 py-2 px-3.5 rounded-t font-semibold text-xs border-b-2 transition whitespace-nowrap uppercase tracking-wider ${
              activeTab === 'history'
                ? 'border-blue-500 text-white bg-gray-800/90 shadow-inner'
                : 'border-transparent text-gray-400 hover:text-gray-200 hover:bg-gray-800/40'
            }`}
          >
            <History className="w-3.5 h-3.5 text-purple-400" />
            <span>3. Audit & History (견적 이력 감사)</span>
          </button>
        </div>
      </div>
    </header>
  );
};

