import React from 'react';
import { Link, NavLink, useLocation } from 'react-router-dom';
import {
  Calculator,
  Database,
  History,
  Layers as SchemaIcon,
  Sparkles,
} from 'lucide-react';

interface HeaderProps {
  pricingCount: number;
  quotesCount: number;
}

/**
 * 퀸 주방가구 시스템 상단 글로벌 헤더
 * - 로고 클릭 시 언제든지 메인페이지('/')로 이동
 * - NavLink 기반의 URL 동기화 탭 내비게이션
 */
export const Header: React.FC<HeaderProps> = ({
  pricingCount,
  quotesCount,
}) => {
  const location = useLocation();
  const pathname = location.pathname;

  // 견적 관리 탭 활성 조건: /history 또는 /quotes 로 시작하는 경우
  const isHistoryActive = pathname.startsWith('/history') || pathname.startsWith('/quotes');
  // 신규 견적 탭 활성 조건: / 또는 /wizard 로 시작하는 경우
  const isWizardActive = pathname === '/' || pathname.startsWith('/wizard');

  return (
    <header className="bg-[#1e293b] border-b border-gray-700 text-white sticky top-0 z-40 shadow-sm">
      {/* Top Banner / Brand */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6">
        <div className="flex items-center justify-between h-14">
          {/* Logo & System Title — 클릭 시 메인페이지(/)로 이동 */}
          <Link
            to="/"
            className="flex items-center gap-3 group hover:opacity-90 transition-opacity cursor-pointer"
            title="메인페이지(신규 견적)로 이동"
          >
            <img
              src="/queen-os.png"
              alt="Queen OS"
              className="w-8 h-8 rounded object-cover shadow-sm ring-1 ring-white/10 group-hover:ring-blue-400/50 transition-all"
            />
            <div className="flex items-baseline gap-2">
              <h1 className="text-base font-bold tracking-tight text-white uppercase group-hover:text-blue-300 transition-colors">
                QUEEN KITCHEN
              </h1>
              <span className="text-xs font-light text-gray-400 hidden sm:inline font-mono">
                Automated Costing System v2.4
              </span>
            </div>
          </Link>

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

            {/* 시스템 설정 버튼 */}
            <NavLink
              to="/architecture"
              className={({ isActive }) =>
                `text-xs px-2.5 py-1 rounded font-medium transition flex items-center gap-1 border ${
                  isActive
                    ? 'bg-blue-600 text-white border-blue-500 font-semibold'
                    : 'bg-gray-700 hover:bg-gray-600 text-gray-200 border-gray-600'
                }`
              }
              title="시스템 구성 및 처리 흐름"
            >
              <SchemaIcon className="w-3.5 h-3.5 text-blue-300" />
              <span className="hidden sm:inline">시스템 설정</span>
            </NavLink>
          </div>
        </div>

        {/* Navigation Tabs - High Density & Compact */}
        <div className="flex space-x-1 border-t border-gray-700/80 pt-1 overflow-x-auto scrollbar-none text-xs">
          <Link
            to="/"
            className={`flex items-center gap-2 py-2 px-3.5 rounded-t font-semibold text-xs border-b-2 transition whitespace-nowrap ${
              isWizardActive
                ? 'border-blue-500 text-white bg-gray-800/90 shadow-inner'
                : 'border-transparent text-gray-400 hover:text-gray-200 hover:bg-gray-800/40'
            }`}
          >
            <Calculator className="w-3.5 h-3.5 text-blue-400" />
            <span>신규 견적</span>
          </Link>

          <Link
            to="/history"
            className={`flex items-center gap-2 py-2 px-3.5 rounded-t font-semibold text-xs border-b-2 transition whitespace-nowrap ${
              isHistoryActive
                ? 'border-blue-500 text-white bg-gray-800/90 shadow-inner'
                : 'border-transparent text-gray-400 hover:text-gray-200 hover:bg-gray-800/40'
            }`}
          >
            <History className="w-3.5 h-3.5 text-purple-400" />
            <span>견적 관리</span>
          </Link>

          <NavLink
            to="/pricing"
            className={({ isActive }) =>
              `flex items-center gap-2 py-2 px-3.5 rounded-t font-semibold text-xs border-b-2 transition whitespace-nowrap ${
                isActive
                  ? 'border-blue-500 text-white bg-gray-800/90 shadow-inner'
                  : 'border-transparent text-gray-400 hover:text-gray-200 hover:bg-gray-800/40'
              }`
            }
          >
            <Database className="w-3.5 h-3.5 text-green-400" />
            <span>단가 관리</span>
          </NavLink>

          <NavLink
            to="/ai-accuracy"
            className={({ isActive }) =>
              `flex items-center gap-2 py-2 px-3.5 rounded-t font-semibold text-xs border-b-2 transition whitespace-nowrap ${
                isActive
                  ? 'border-blue-500 text-white bg-gray-800/90 shadow-inner'
                  : 'border-transparent text-gray-400 hover:text-gray-200 hover:bg-gray-800/40'
              }`
            }
            title="AI 파싱 결과를 사람이 얼마나 고쳤는지"
          >
            <Sparkles className="w-3.5 h-3.5 text-amber-400" />
            <span>AI 정확도</span>
          </NavLink>
        </div>
      </div>
    </header>
  );
};
