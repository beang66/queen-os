import React from 'react';
import { ArrowRight, Building2, Layers, CheckCircle2 } from 'lucide-react';
import { OrderEntity } from '../../types';

interface ExtractedOrderPreviewProps {
  orderEntity: OrderEntity | null;
  onTransferToQuote: (order: OrderEntity) => void;
}

/**
 * AI 파싱으로 구조화된 주방 주문 엔티티(OrderEntity) 데이터 카드 및 전송 컴포넌트
 */
export const ExtractedOrderPreview: React.FC<ExtractedOrderPreviewProps> = ({
  orderEntity,
  onTransferToQuote,
}) => {
  if (!orderEntity) return null;

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-gray-100 pb-3">
        <div>
          <h3 className="text-sm font-bold text-gray-800 flex items-center gap-2">
            <Building2 className="w-4 h-4 text-blue-600" />
            AI 파싱 추출 주방 주문 엔티티 ({orderEntity.customerName})
          </h3>
          <p className="text-xs text-gray-500 mt-0.5">
            자연어 및 문서에서 자동 정제된 주방 규격/자재 구조입니다.
          </p>
        </div>

        <button
          type="button"
          onClick={() => onTransferToQuote(orderEntity)}
          className="bg-blue-600 hover:bg-blue-700 text-white font-medium text-xs px-4 py-2 rounded-lg flex items-center justify-center gap-1.5 shadow-sm transition-colors"
        >
          <span>견적서 마법사로 이 주문 전송</span>
          <ArrowRight className="w-3.5 h-3.5" />
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
        {/* 고객 기본 정보 */}
        <div className="bg-slate-50 p-3.5 rounded-lg border border-slate-200 space-y-1.5">
          <div className="font-bold text-slate-700 text-xs border-b border-slate-200 pb-1">
            고객 & 현장 정보
          </div>
          <div><span className="text-slate-500">고객명:</span> <span className="font-semibold text-slate-800">{orderEntity.customerName}</span></div>
          <div><span className="text-slate-500">연락처:</span> <span className="font-mono text-slate-800">{orderEntity.contact}</span></div>
          <div><span className="text-slate-500">주소:</span> <span className="text-slate-800">{orderEntity.address}</span></div>
        </div>

        {/* 레이아웃 & 주요 치수 */}
        <div className="bg-slate-50 p-3.5 rounded-lg border border-slate-200 space-y-1.5">
          <div className="font-bold text-slate-700 text-xs border-b border-slate-200 pb-1">
            주방 레이아웃 & 치수 (mm)
          </div>
          <div><span className="text-slate-500">형태:</span> <span className="font-semibold text-blue-600">{orderEntity.layoutType}</span></div>
          <div><span className="text-slate-500">하부장 길이:</span> <span className="font-mono font-semibold">{orderEntity.dimensions.lowerCabinetLengthMm} mm</span></div>
          <div><span className="text-slate-500">상부장 길이:</span> <span className="font-mono font-semibold">{orderEntity.dimensions.upperCabinetLengthMm} mm</span></div>
        </div>

        {/* 도어 및 인조대리석 자재 */}
        <div className="bg-slate-50 p-3.5 rounded-lg border border-slate-200 space-y-1.5">
          <div className="font-bold text-slate-700 text-xs border-b border-slate-200 pb-1">
            선택 자재 옵션
          </div>
          <div><span className="text-slate-500">도어:</span> <span className="font-medium text-slate-800">{orderEntity.doorOption.material}</span></div>
          <div><span className="text-slate-500">상판:</span> <span className="font-medium text-slate-800">{orderEntity.countertopOption.brand} {orderEntity.countertopOption.model}</span></div>
          <div><span className="text-slate-500">수전/싱크:</span> <span className="text-slate-700">{orderEntity.appliances.sinkBowlModel}</span></div>
        </div>
      </div>
    </div>
  );
};
