import React from 'react';
import { Database, FileSpreadsheet } from 'lucide-react';
import { ParsedPriceItem } from '../../types';

interface ExtractedPricingTableProps {
  items: ParsedPriceItem[];
  onApplyToPricingDb: (items: ParsedPriceItem[]) => void;
}

/**
 * AI 문서 분석으로 추출된 단가표 품목 목록 테이블 및 DB 일괄 저장 컴포넌트
 */
export const ExtractedPricingTable: React.FC<ExtractedPricingTableProps> = ({
  items,
  onApplyToPricingDb,
}) => {
  if (items.length === 0) return null;

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-gray-100 pb-3">
        <div>
          <h3 className="text-sm font-bold text-gray-800 flex items-center gap-2">
            <FileSpreadsheet className="w-4 h-4 text-green-600" />
            AI 파싱 추출 단가 목록 ({items.length}개 품목 감지)
          </h3>
          <p className="text-xs text-gray-500 mt-0.5">
            문서에서 감지된 단가 항목들입니다. 검토 후 단가표 DB에 일괄 반영할 수 있습니다.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => onApplyToPricingDb(items)}
            className="bg-green-600 hover:bg-green-700 text-white font-medium text-xs px-4 py-2 rounded-lg flex items-center gap-1.5 shadow-sm transition-colors"
          >
            <Database className="w-3.5 h-3.5" />
            <span>단가표 DB에 일괄 적재</span>
          </button>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs border-collapse">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-200 text-gray-600 font-medium">
              <th className="py-2.5 px-3">코드</th>
              <th className="py-2.5 px-3">카테고리</th>
              <th className="py-2.5 px-3">품목명</th>
              <th className="py-2.5 px-3">규격 / 재질</th>
              <th className="py-2.5 px-3 text-right">매입 원가</th>
              <th className="py-2.5 px-3 text-right">표준 판매가</th>
              <th className="py-2.5 px-3">공급업체</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 font-mono">
            {items.map((item, idx) => (
              <tr key={idx} className="hover:bg-gray-50/80 transition-colors">
                <td className="py-2 px-3 text-gray-500">{item.code || '-'}</td>
                <td className="py-2 px-3 font-sans font-medium text-gray-700">{item.category || '-'}</td>
                <td className="py-2 px-3 font-sans font-bold text-gray-900">{item.name}</td>
                <td className="py-2 px-3 font-sans text-gray-600">{item.spec || item.material || '-'}</td>
                <td className="py-2 px-3 text-right text-gray-700">
                  ₩{(item.costPrice || 0).toLocaleString()}
                </td>
                <td className="py-2 px-3 text-right font-bold text-blue-600">
                  ₩{(item.sellingPrice || 0).toLocaleString()}
                </td>
                <td className="py-2 px-3 font-sans text-gray-500">{item.supplier || '퀸 퍼니처'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};
