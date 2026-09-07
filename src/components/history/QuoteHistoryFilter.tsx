import React from 'react';
import { Search, History, RefreshCw } from 'lucide-react';
import { QuoteStatus } from '../../types';

interface QuoteHistoryFilterProps {
  searchQuery: string;
  setSearchQuery: (q: string) => void;
  statusFilter: QuoteStatus | 'ALL';
  setStatusFilter: (st: QuoteStatus | 'ALL') => void;
  totalCount: number;
  onRefresh: () => void;
}

/**
 * 견적서 이력 검색 및 진행 상태 필터 컨트롤 바 컴포넌트
 */
export const QuoteHistoryFilter: React.FC<QuoteHistoryFilterProps> = ({
  searchQuery,
  setSearchQuery,
  statusFilter,
  setStatusFilter,
  totalCount,
  onRefresh,
}) => {
  const statusOptions: { id: QuoteStatus | 'ALL'; label: string }[] = [
    { id: 'ALL', label: '전체 상태' },
    { id: 'DRAFT', label: '임시 저장' },
    { id: 'ISSUED', label: '견적 발행' },
    { id: 'NEGOTIATING', label: '협상 중' },
    { id: 'CONFIRMED', label: '견적 확정' },
    { id: 'IN_PRODUCTION', label: '제작 중' },
    { id: 'COMPLETED', label: '시공 완료' },
    { id: 'CANCELLED', label: '취소됨' },
  ];

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm space-y-3">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-gray-100 pb-3">
        <div className="flex items-center gap-2">
          <History className="w-5 h-5 text-indigo-600" />
          <h2 className="text-base font-bold text-gray-800">영업 견적서 발행 이력 및 감사(Audit) DB</h2>
          <span className="bg-indigo-100 text-indigo-800 font-mono text-xs font-bold px-2 py-0.5 rounded-full">
            총 {totalCount}건 이력
          </span>
        </div>

        <button
          type="button"
          onClick={onRefresh}
          className="border border-gray-300 hover:bg-gray-50 text-gray-600 text-xs px-3 py-1.5 rounded-lg flex items-center gap-1 transition-colors self-start sm:self-auto"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          <span>새로고침</span>
        </button>
      </div>

      <div className="flex flex-col sm:flex-row items-center gap-3">
        <div className="relative flex-1 w-full">
          <Search className="w-4 h-4 text-gray-400 absolute left-3 top-2.5" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="견적 번호, 제목, 고객명, 주소 검색..."
            className="w-full pl-9 pr-3 py-1.5 border border-gray-300 rounded-lg text-xs focus:border-blue-500 focus:outline-none"
          />
        </div>

        <div className="flex items-center gap-1.5 overflow-x-auto w-full sm:w-auto pb-1 sm:pb-0">
          <span className="text-xs text-gray-500 font-medium whitespace-nowrap">상태:</span>
          {statusOptions.map((opt) => (
            <button
              key={opt.id}
              type="button"
              onClick={() => setStatusFilter(opt.id)}
              className={`px-2.5 py-1 rounded-lg text-xs font-medium whitespace-nowrap transition-all ${
                statusFilter === opt.id
                  ? 'bg-indigo-600 text-white'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};
