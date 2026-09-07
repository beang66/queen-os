import React, { useState, useMemo } from 'react';
import { QuoteHistoryFilter } from './history/QuoteHistoryFilter';
import { QuoteHistoryTable } from './history/QuoteHistoryTable';
import { QuoteDetailModal } from './history/QuoteDetailModal';
import { QuoteDocument, QuoteStatus } from '../types';

interface QuoteHistoryAuditProps {
  quotes: QuoteDocument[];
  onRefresh: () => Promise<void>;
  onUpdateStatus: (id: string, status: QuoteStatus) => Promise<void>;
  onDeleteQuote: (id: string) => Promise<void>;
}

/**
 * 퀸 주방가구 영업 견적 이력 & 감사 관리 (QuoteHistoryAudit) 메인 컨테이너 컴포넌트
 */
export const QuoteHistoryAudit: React.FC<QuoteHistoryAuditProps> = ({
  quotes,
  onRefresh,
  onUpdateStatus,
  onDeleteQuote,
}) => {
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<QuoteStatus | 'ALL'>('ALL');
  const [selectedQuote, setSelectedQuote] = useState<QuoteDocument | null>(null);

  // 검색 및 상태 필터링된 견적서 이력
  const filteredQuotes = useMemo(() => {
    return quotes.filter((q) => {
      const matchStatus = statusFilter === 'ALL' || q.status === statusFilter;
      const query = searchQuery.toLowerCase();
      const matchQuery =
        !query ||
        q.quoteNumber.toLowerCase().includes(query) ||
        q.title.toLowerCase().includes(query) ||
        q.orderEntity.customerName.toLowerCase().includes(query) ||
        q.orderEntity.address.toLowerCase().includes(query);
      return matchStatus && matchQuery;
    });
  }, [quotes, statusFilter, searchQuery]);

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* 1. 검색어 & 상태 필터 바 */}
      <QuoteHistoryFilter
        searchQuery={searchQuery}
        setSearchQuery={setSearchQuery}
        statusFilter={statusFilter}
        setStatusFilter={setStatusFilter}
        totalCount={filteredQuotes.length}
        onRefresh={onRefresh}
      />

      {/* 2. 견적서 이력 테이블 */}
      <QuoteHistoryTable
        quotes={filteredQuotes}
        onSelectQuote={(quote) => setSelectedQuote(quote)}
        onUpdateStatus={onUpdateStatus}
        onDeleteQuote={onDeleteQuote}
      />

      {/* 3. 견적서 상세 정보 팝업 모달 */}
      <QuoteDetailModal
        quote={selectedQuote}
        onClose={() => setSelectedQuote(null)}
      />
    </div>
  );
};
