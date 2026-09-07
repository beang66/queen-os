import React from 'react';
import { Search, Plus, RefreshCw, Database, Sparkles } from 'lucide-react';

interface PricingFilterBarProps {
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  selectedCategory: string;
  setSelectedCategory: (cat: string) => void;
  categories: string[];
  totalCount: number;
  onOpenAddModal: () => void;
  onResetSeed: () => void;
  onOpenAiExtractor?: () => void;
}

/**
 * 단가표 DB 검색, 카테고리 필터링 및 조작 버튼 바 컴포넌트
 */
export const PricingFilterBar: React.FC<PricingFilterBarProps> = ({
  searchQuery,
  setSearchQuery,
  selectedCategory,
  setSelectedCategory,
  categories,
  totalCount,
  onOpenAddModal,
  onResetSeed,
  onOpenAiExtractor,
}) => {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm space-y-3">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-gray-100 pb-3">
        <div className="flex items-center gap-2">
          <Database className="w-5 h-5 text-blue-600" />
          <h2 className="text-base font-bold text-gray-800">퀸 주방가구 표준 단가표 카탈로그 DB</h2>
          <span className="bg-blue-100 text-blue-800 font-mono text-xs font-bold px-2 py-0.5 rounded-full">
            총 {totalCount}개 품목
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {onOpenAiExtractor && (
            <button
              type="button"
              onClick={onOpenAiExtractor}
              className="bg-purple-600 hover:bg-purple-700 text-white font-medium text-xs px-3.5 py-1.5 rounded-lg flex items-center gap-1.5 shadow-sm transition-colors"
              title="PDF나 거래처 단가표 이미지에서 단가를 자동 추출하여 DB에 일괄 적재합니다"
            >
              <Sparkles className="w-3.5 h-3.5 text-amber-300" />
              <span>AI 단가표 일괄 추출·적재</span>
            </button>
          )}
          <button
            type="button"
            onClick={onResetSeed}
            className="border border-gray-300 hover:bg-gray-50 text-gray-600 text-xs px-3 py-1.5 rounded-lg flex items-center gap-1 transition-colors"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>표준 카탈로그 초기화</span>
          </button>
          <button
            type="button"
            onClick={onOpenAddModal}
            className="bg-blue-600 hover:bg-blue-700 text-white font-medium text-xs px-3.5 py-1.5 rounded-lg flex items-center gap-1 shadow-sm transition-colors"
          >
            <Plus className="w-4 h-4" />
            <span>신규 단가 품목 추가</span>
          </button>
        </div>
      </div>

      {/* 검색어 & 카테고리 필터 */}
      <div className="flex flex-col sm:flex-row items-center gap-3">
        <div className="relative flex-1 w-full">
          <Search className="w-4 h-4 text-gray-400 absolute left-3 top-2.5" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="품목명, 자재명, 공급업체명으로 검색..."
            className="w-full pl-9 pr-3 py-1.5 border border-gray-300 rounded-lg text-xs focus:border-blue-500 focus:outline-none"
          />
        </div>

        <div className="flex items-center gap-1.5 overflow-x-auto w-full sm:w-auto pb-1 sm:pb-0">
          <span className="text-xs text-gray-500 font-medium whitespace-nowrap">분류:</span>
          {categories.map((cat) => (
            <button
              key={cat}
              type="button"
              onClick={() => setSelectedCategory(cat)}
              className={`px-2.5 py-1 rounded-lg text-xs font-medium whitespace-nowrap transition-all ${
                selectedCategory === cat
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {cat === 'ALL' ? '전체 품목' : cat}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};
