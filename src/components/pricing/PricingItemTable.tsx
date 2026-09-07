import React from 'react';
import { Edit2, Trash2 } from 'lucide-react';
import { PricingItem } from '../../types';

interface PricingItemTableProps {
  items: PricingItem[];
  onEdit: (item: PricingItem) => void;
  onDelete: (id: string) => void;
}

/**
 * 단가표 품목 목록 테이블 컴포넌트
 */
export const PricingItemTable: React.FC<PricingItemTableProps> = ({
  items,
  onEdit,
  onDelete,
}) => {
  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs border-collapse">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-200 text-gray-600 font-semibold">
              <th className="py-3 px-3.5">코드</th>
              <th className="py-3 px-3.5">카테고리</th>
              <th className="py-3 px-3.5">품목명</th>
              <th className="py-3 px-3.5">규격 / 재질</th>
              <th className="py-3 px-3.5 text-center">단위</th>
              <th className="py-3 px-3.5 text-right">매입 원가</th>
              <th className="py-3 px-3.5 text-right">표준 판매가</th>
              <th className="py-3 px-3.5">공급업체</th>
              <th className="py-3 px-3.5 text-center">관리</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 font-mono">
            {items.length === 0 ? (
              <tr>
                <td colSpan={9} className="py-8 text-center text-gray-400 font-sans">
                  조회된 단가 품목이 없습니다.
                </td>
              </tr>
            ) : (
              items.map((item) => (
                <tr key={item.id} className="hover:bg-gray-50/80 transition-colors">
                  <td className="py-2.5 px-3.5 text-gray-500 font-bold">{item.code}</td>
                  <td className="py-2.5 px-3.5 font-sans font-medium text-gray-700">
                    <span className="bg-slate-100 text-slate-700 px-2 py-0.5 rounded text-[11px]">
                      {item.category}
                    </span>
                  </td>
                  <td className="py-2.5 px-3.5 font-sans font-bold text-gray-900">{item.name}</td>
                  <td className="py-2.5 px-3.5 font-sans text-gray-600">
                    {item.spec} {item.material && `(${item.material})`}
                  </td>
                  <td className="py-2.5 px-3.5 text-center font-sans text-gray-600">{item.unit}</td>
                  <td className="py-2.5 px-3.5 text-right font-semibold text-gray-700">
                    ₩{item.costPrice.toLocaleString()}
                  </td>
                  <td className="py-2.5 px-3.5 text-right font-bold text-blue-600">
                    ₩{item.sellingPrice.toLocaleString()}
                  </td>
                  <td className="py-2.5 px-3.5 font-sans text-gray-500">{item.supplier}</td>
                  <td className="py-2.5 px-3.5 text-center">
                    <div className="flex items-center justify-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => onEdit(item)}
                        className="text-gray-400 hover:text-blue-600 p-1 rounded hover:bg-gray-100 transition-colors"
                        title="수정"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          if (confirm(`'${item.name}' 품목을 삭제하시겠습니까?`)) {
                            onDelete(item.id);
                          }
                        }}
                        className="text-gray-400 hover:text-red-600 p-1 rounded hover:bg-gray-100 transition-colors"
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
