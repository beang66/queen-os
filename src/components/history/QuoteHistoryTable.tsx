import React from 'react';
import { Eye, Trash2 } from 'lucide-react';
import { QuoteDocument, QuoteStatus } from '../../types';

interface QuoteHistoryTableProps {
  quotes: QuoteDocument[];
  onSelectQuote: (quote: QuoteDocument) => void;
  onUpdateStatus: (id: string, status: QuoteStatus) => void;
  onDeleteQuote: (id: string) => void;
}

/**
 * 저장된 견적서 목록 이력 테이블 컴포넌트
 */
export const QuoteHistoryTable: React.FC<QuoteHistoryTableProps> = ({
  quotes,
  onSelectQuote,
  onUpdateStatus,
  onDeleteQuote,
}) => {
  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs border-collapse">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-200 text-gray-600 font-semibold">
              <th className="py-3 px-3.5">견적번호</th>
              <th className="py-3 px-3.5">견적서 제목</th>
              <th className="py-3 px-3.5">고객명</th>
              <th className="py-3 px-3.5 text-center">마진율</th>
              <th className="py-3 px-3.5 text-right">총 제조원가</th>
              <th className="py-3 px-3.5 text-right">견적 공급가</th>
              <th className="py-3 px-3.5 text-center">진행 상태</th>
              <th className="py-3 px-3.5">발행일자</th>
              <th className="py-3 px-3.5 text-center">관리</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 font-mono">
            {quotes.length === 0 ? (
              <tr>
                <td colSpan={9} className="py-8 text-center text-gray-400 font-sans">
                  저장된 견적서 이력이 없습니다.
                </td>
              </tr>
            ) : (
              quotes.map((quote) => (
                <tr key={quote.id} className="hover:bg-gray-50/80 transition-colors">
                  <td className="py-3 px-3.5 text-blue-600 font-bold">#{quote.quoteNumber}</td>
                  <td className="py-3 px-3.5 font-sans font-bold text-gray-900">{quote.title}</td>
                  <td className="py-3 px-3.5 font-sans font-medium text-gray-700">
                    {quote.orderEntity.customerName}
                  </td>
                  <td className="py-3 px-3.5 text-center font-bold text-emerald-600">
                    {quote.targetMarginRate}%
                  </td>
                  <td className="py-3 px-3.5 text-right text-gray-600">
                    ₩{(quote.calculationResult?.summary?.totalManufacturingCost || 0).toLocaleString()}
                  </td>
                  <td className="py-3 px-3.5 text-right font-extrabold text-blue-700">
                    ₩{(quote.calculationResult?.summary?.totalSellingPrice || 0).toLocaleString()}
                  </td>
                  <td className="py-3 px-3.5 text-center font-sans">
                    <select
                      value={quote.status}
                      onChange={(e) => onUpdateStatus(quote.id, e.target.value as QuoteStatus)}
                      className="bg-transparent border border-gray-200 rounded px-1.5 py-0.5 text-[11px] font-semibold focus:outline-none"
                    >
                      <option value="DRAFT">임시저장</option>
                      <option value="ISSUED">견적발행</option>
                      <option value="NEGOTIATING">협상중</option>
                      <option value="CONFIRMED">견적확정</option>
                      <option value="IN_PRODUCTION">제작중</option>
                      <option value="COMPLETED">시공완료</option>
                      <option value="CANCELLED">취소됨</option>
                    </select>
                  </td>
                  <td className="py-3 px-3.5 text-gray-500 font-sans text-[11px]">
                    {new Date(quote.createdAt).toLocaleDateString('ko-KR')}
                  </td>
                  <td className="py-3 px-3.5 text-center">
                    <div className="flex items-center justify-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => onSelectQuote(quote)}
                        className="text-gray-400 hover:text-blue-600 p-1 rounded hover:bg-gray-100 transition-colors"
                        title="상세 보기"
                      >
                        <Eye className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          if (confirm(`견적서 #${quote.quoteNumber}를 삭제하시겠습니까?`)) {
                            onDeleteQuote(quote.id);
                          }
                        }}
                        className="text-gray-400 hover:text-rose-600 p-1 rounded hover:bg-gray-100 transition-colors"
                        title="삭제"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};
