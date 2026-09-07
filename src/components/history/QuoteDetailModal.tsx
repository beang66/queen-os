import React from 'react';
import { X, Printer, Building2 } from 'lucide-react';
import { QuoteDocument } from '../../types';

interface QuoteDetailModalProps {
  quote: QuoteDocument | null;
  onClose: () => void;
}

/**
 * 저장된 견적서 상세 정보 팝업 모달 컴포넌트
 */
export const QuoteDetailModal: React.FC<QuoteDetailModalProps> = ({ quote, onClose }) => {
  if (!quote) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-2xl max-w-3xl w-full max-h-[90vh] overflow-y-auto flex flex-col">
        {/* 모달 헤더 */}
        <div className="bg-slate-900 text-white px-6 py-4 flex items-center justify-between sticky top-0 z-10">
          <div>
            <span className="text-xs text-blue-400 font-mono font-bold">#{quote.quoteNumber}</span>
            <h3 className="text-base font-bold">{quote.title}</h3>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => window.print()}
              className="text-slate-300 hover:text-white p-1.5 rounded hover:bg-slate-800 transition-colors text-xs flex items-center gap-1"
            >
              <Printer className="w-4 h-4" />
              <span>인쇄</span>
            </button>
            <button
              type="button"
              onClick={onClose}
              className="text-slate-400 hover:text-white p-1 rounded transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* 모달 본문 */}
        <div className="p-6 space-y-6 text-xs text-slate-800">
          {/* 요약 정보 카드 */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-slate-50 p-4 rounded-lg border border-slate-200">
            <div>
              <span className="text-slate-500 font-medium">고객명</span>
              <div className="font-bold text-slate-900 mt-0.5">{quote.orderEntity.customerName}</div>
            </div>
            <div>
              <span className="text-slate-500 font-medium">적용 마진율</span>
              <div className="font-mono font-bold text-emerald-600 mt-0.5">{quote.targetMarginRate}%</div>
            </div>
            <div>
              <span className="text-slate-500 font-medium">제조 원가</span>
              <div className="font-mono font-bold text-slate-700 mt-0.5">
                ₩{(quote.calculationResult.summary.totalManufacturingCost || 0).toLocaleString()}
              </div>
            </div>
            <div>
              <span className="text-slate-500 font-medium">최종 공급가</span>
              <div className="font-mono font-extrabold text-blue-600 mt-0.5">
                ₩{(quote.calculationResult.summary.totalSellingPrice || 0).toLocaleString()}
              </div>
            </div>
          </div>

          {/* 현장 및 규격 사양 */}
          <div className="space-y-2">
            <h4 className="font-bold text-slate-800 flex items-center gap-1.5 border-b border-slate-200 pb-1.5">
              <Building2 className="w-4 h-4 text-blue-600" />
              주문 규격 및 자재 사양
            </h4>
            <div className="grid grid-cols-2 gap-4 text-xs bg-slate-50/50 p-3 rounded border border-slate-200">
              <div>
                <span className="text-slate-500">현장 주소:</span> {quote.orderEntity.address}
              </div>
              <div>
                <span className="text-slate-500">레이아웃:</span> {quote.orderEntity.layoutType}
              </div>
              <div>
                <span className="text-slate-500">하부장/상부장:</span>{' '}
                {quote.orderEntity.dimensions.lowerCabinetLengthMm}mm /{' '}
                {quote.orderEntity.dimensions.upperCabinetLengthMm}mm
              </div>
              <div>
                <span className="text-slate-500">도어 사양:</span> {quote.orderEntity.doorOption.material}
              </div>
            </div>
          </div>

          {/* 원가 산출 세부 내역 */}
          <div className="space-y-2">
            <h4 className="font-bold text-slate-800 border-b border-slate-200 pb-1.5">
              원가 산출 항목 내역 ({(quote.calculationResult.breakdowns || []).length}개)
            </h4>
            <table className="w-full text-left text-xs border-collapse border border-slate-200">
              <thead>
                <tr className="bg-slate-100 font-bold border-b border-slate-200 text-slate-700">
                  <th className="py-2 px-3">카테고리</th>
                  <th className="py-2 px-3">품목명</th>
                  <th className="py-2 px-3 text-right">수량</th>
                  <th className="py-2 px-3 text-right">원가</th>
                  <th className="py-2 px-3 text-right">공급가</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 font-mono">
                {(quote.calculationResult.breakdowns || []).map((item, idx) => (
                  <tr key={idx} className="hover:bg-slate-50">
                    <td className="py-2 px-3 font-sans text-slate-700">{item.category}</td>
                    <td className="py-2 px-3 font-sans font-medium text-slate-900">{item.name}</td>
                    <td className="py-2 px-3 text-right">
                      {item.quantity} {item.unit}
                    </td>
                    <td className="py-2 px-3 text-right text-slate-600">
                      ₩{(item.costTotal || 0).toLocaleString()}
                    </td>
                    <td className="py-2 px-3 text-right font-bold text-blue-600">
                      ₩{(item.sellingTotal || 0).toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};
