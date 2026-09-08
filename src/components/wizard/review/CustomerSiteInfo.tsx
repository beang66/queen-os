import React from 'react';
import { UserRound, AlertCircle } from 'lucide-react';
import { OrderEntity } from '../../../types';

interface CustomerSiteInfoProps {
  orderEntity: OrderEntity;
  setOrderEntity: React.Dispatch<React.SetStateAction<OrderEntity>>;
}

const ExtractedTag: React.FC = () => (
  <span className="text-[10px] font-medium text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded whitespace-nowrap">
    상담 메모에서 추출
  </span>
);

const NeedsCheckTag: React.FC = () => (
  <span className="text-[10px] font-bold text-white bg-orange-500 px-1.5 py-0.5 rounded whitespace-nowrap">
    확인 필요
  </span>
);

const fieldBox = (filled: boolean) =>
  `flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 bg-white transition-colors focus-within:border-blue-500 ${
    filled ? 'border-gray-200' : 'border-orange-400 bg-orange-50/40'
  }`;
const bareInput = 'w-full bg-transparent text-xs text-gray-800 font-medium focus:outline-none min-w-0';
const selectCls =
  'w-full rounded-lg border border-gray-200 bg-white px-2.5 py-1.5 text-xs text-gray-800 font-medium focus:border-blue-500 focus:outline-none';

/** 값이 인풋 안에 태그와 함께 들어가는 텍스트 필드 (모듈 스코프에 두어 리렌더 시 리마운트되지 않도록 함) */
const TextField: React.FC<{
  label: string;
  required?: boolean;
  value: string;
  placeholder?: string;
  onChange: (v: string) => void;
  helper?: string;
  className?: string;
}> = ({ label, required, value, placeholder, onChange, helper, className }) => {
  const filled = !!value.trim();
  return (
    <div className={className}>
      <label className="block text-[11px] font-medium text-gray-500 mb-1">
        {label} {required && <span className="text-orange-500">*</span>}
      </label>
      <div className={fieldBox(filled)}>
        <input className={bareInput} value={value} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} />
        {filled ? <ExtractedTag /> : <NeedsCheckTag />}
      </div>
      {!filled && helper && (
        <p className="text-[10px] text-orange-600 font-medium mt-1 flex items-center gap-1">
          <AlertCircle className="w-3 h-3" />
          {helper}
        </p>
      )}
    </div>
  );
};

/** 태그가 필드 아래에 붙는 날짜/선택 필드 */
const BelowTag: React.FC<{ filled: boolean }> = ({ filled }) => (
  <div className="mt-1 flex justify-end">{filled ? <ExtractedTag /> : <NeedsCheckTag />}</div>
);

/**
 * 규격 검수 - 고객 및 현장 정보 패널
 * 값이 비어 있는 필수 항목은 '확인 필요'로, AI가 채운 항목은 '상담 메모에서 추출'로 표시합니다.
 */
export const CustomerSiteInfo: React.FC<CustomerSiteInfoProps> = ({ orderEntity, setOrderEntity }) => {
  const set = (patch: Partial<OrderEntity>) => setOrderEntity((prev) => ({ ...prev, ...patch }));

  return (
    <div className="rounded-xl border border-blue-100 bg-blue-50/40 p-4 space-y-3">
      <div className="flex items-center gap-1.5">
        <UserRound className="w-4 h-4 text-blue-500" />
        <h4 className="text-xs font-bold text-gray-800">고객 및 현장 정보</h4>
      </div>

      {/* 1행: 고객명 / 연락처 / 현장 주소 */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <TextField label="고객명" required value={orderEntity.customerName} placeholder="고객명" onChange={(v) => set({ customerName: v })} helper="고객명을 입력해주세요." />
        <TextField label="연락처" required value={orderEntity.contact} placeholder="010-0000-0000" onChange={(v) => set({ contact: v })} helper="연락처를 입력해주세요." />
        <TextField label="현장 주소" required value={orderEntity.address} placeholder="현장 주소" onChange={(v) => set({ address: v })} helper="현장 주소를 입력해주세요." />
      </div>

      {/* 2행: 프로젝트명 / 상담일 / 희망 시공일 / 고객 유형 / 담당자 */}
      <div className="grid grid-cols-2 md:grid-cols-12 gap-3">
        <TextField
          className="col-span-2 md:col-span-4"
          label="프로젝트명"
          value={orderEntity.projectName ?? ''}
          placeholder="예: 서초 래미안 주방 리모델링"
          onChange={(v) => set({ projectName: v })}
          helper="프로젝트명을 확인해주세요."
        />

        <div className="md:col-span-2">
          <label className="block text-[11px] font-medium text-gray-500 mb-1">
            상담일 <span className="text-orange-500">*</span>
          </label>
          <input type="date" className={selectCls} value={orderEntity.consultDate ?? ''} onChange={(e) => set({ consultDate: e.target.value })} />
          <BelowTag filled={!!orderEntity.consultDate} />
        </div>

        <div className="md:col-span-2">
          <label className="block text-[11px] font-medium text-gray-500 mb-1">
            희망 시공일 <span className="text-orange-500">*</span>
          </label>
          <input type="date" className={selectCls} value={orderEntity.deliveryDate ?? ''} onChange={(e) => set({ deliveryDate: e.target.value })} />
          <BelowTag filled={!!orderEntity.deliveryDate} />
        </div>

        <div className="md:col-span-2">
          <label className="block text-[11px] font-medium text-gray-500 mb-1">
            고객 유형 <span className="text-orange-500">*</span>
          </label>
          <select className={selectCls} value={orderEntity.customerType ?? ''} onChange={(e) => set({ customerType: e.target.value })}>
            <option value="">선택하세요</option>
            <option value="일반 고객">일반 고객</option>
            <option value="인테리어 업체">인테리어 업체</option>
            <option value="재시공 고객">재시공 고객</option>
            <option value="빌더/시행사">빌더/시행사</option>
            {orderEntity.customerType &&
              !['일반 고객', '인테리어 업체', '재시공 고객', '빌더/시행사'].includes(orderEntity.customerType) && (
                <option value={orderEntity.customerType}>{orderEntity.customerType}</option>
              )}
          </select>
          <BelowTag filled={!!orderEntity.customerType} />
        </div>

        <div className="md:col-span-2">
          <label className="block text-[11px] font-medium text-gray-500 mb-1">
            담당자 <span className="text-orange-500">*</span>
          </label>
          <select className={selectCls} value={orderEntity.manager ?? ''} onChange={(e) => set({ manager: e.target.value })}>
            <option value="">선택하세요</option>
            <option value="문하윤">문하윤</option>
            <option value="안소연">안소연</option>
            <option value="안정빈">안정빈</option>
            {orderEntity.manager && !['문하윤', '안소연', '안정빈'].includes(orderEntity.manager) && (
              <option value={orderEntity.manager}>{orderEntity.manager}</option>
            )}
          </select>
          <BelowTag filled={!!orderEntity.manager} />
        </div>
      </div>
    </div>
  );
};
