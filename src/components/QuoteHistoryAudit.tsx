import React, { useState, useMemo, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { QuoteHistoryFilter } from './history/QuoteHistoryFilter';
import { QuoteHistoryTable } from './history/QuoteHistoryTable';
import { QuoteDetailModal } from './history/QuoteDetailModal';
import { DraftListPanel } from './history/DraftListPanel';
import { QuoteDocument, QuoteStatus } from '../types';

interface QuoteHistoryAuditProps {
  quotes: QuoteDocument[];
  onRefresh: () => Promise<void>;
  onUpdateStatus: (id: string, status: QuoteStatus) => Promise<void>;
  onDeleteQuote: (id: string) => Promise<void>;
  /** 초안을 신규 견적 탭에서 이어서 작성 */
  onResumeDraft: (id: string) => void;
}

/**
 * 퀸 주방가구 영업 견적 이력 & 감사 관리 (QuoteHistoryAudit) 메인 컨테이너 컴포넌트
 */
export const QuoteHistoryAudit: React.FC<QuoteHistoryAuditProps> = ({
  quotes,
  onRefresh,
  onUpdateStatus,
  onDeleteQuote,
  onResumeDraft,
}) => {
  const navigate = useNavigate();
  const { id: quoteUrlId } = useParams<{ id?: string }>();
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<QuoteStatus | 'ALL'>('ALL');
  const [selectedQuote, setSelectedQuote] = useState<QuoteDocument | null>(null);

  // URL 에 :id 가 있는 경우 해당 견적서를 자동으로 선택하여 모달 열기
  useEffect(() => {
    if (quoteUrlId) {
      const match = quotes.find((q) => q.id === quoteUrlId || q.quoteNumber === quoteUrlId);
      if (match) {
        setSelectedQuote(match);
      }
    } else {
      setSelectedQuote(null);
    }
  }, [quoteUrlId, quotes]);

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
      {/* 0. 작성 중인 견적 초안 */}
      <DraftListPanel onResumeDraft={onResumeDraft} />

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
        onSelectQuote={(quote) => {
          setSelectedQuote(quote);
          navigate(`/quotes/${quote.id}`);
        }}
        onUpdateStatus={onUpdateStatus}
        onDeleteQuote={onDeleteQuote}
      />

      {/* 3. 견적서 상세 정보 팝업 모달 */}
      <QuoteDetailModal
        quote={selectedQuote}
        onClose={() => {
          setSelectedQuote(null);
          navigate('/history');
        }}
      />
    </div>
  );
};
