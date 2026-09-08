import React, { useState } from 'react';
import { Settings, ChevronDown } from 'lucide-react';
import { OrderEntity } from '../../../types';

interface DetailOptionsPanelProps {
  orderEntity: OrderEntity;
  setOrderEntity: React.Dispatch<React.SetStateAction<OrderEntity>>;
}

/**
 * 규격 검수 - 세부 옵션 (손잡이 / 엣지 / 싱크볼 / 수전 / 후드 / 양중 조건)
 */
export const DetailOptionsPanel: React.FC<DetailOptionsPanelProps> = ({ orderEntity, setOrderEntity }) => {
  const [open, setOpen] = useState(false);
  const set = (patch: Partial<OrderEntity>) => setOrderEntity({ ...orderEntity, ...patch });

  const inputCls =
    'w-full rounded-lg border border-gray-200 bg-white px-2.5 py-1.5 text-xs text-gray-800 focus:border-blue-500 focus:outline-none';

  return (
    <div className="rounded-xl border border-gray-200 bg-white">
      <button type="button" onClick={() => setOpen((v) => !v)} className="w-full flex items-center justify-between gap-3 p-4 text-left">
        <div className="flex items-start gap-1.5">
          <Settings className="w-4 h-4 text-gray-500 mt-0.5" />
          <div>
            <h4 className="text-xs font-bold text-gray-800">
              세부 옵션 <span className="text-gray-400 font-medium">(6)</span>
            </h4>
            <p className="text-[11px] text-gray-500 mt-0.5">
              손잡이, 엣지, 싱크볼, 수전, 후드, 엘리베이터/사다리차 등의 옵션을 설정하세요.
            </p>
          </div>
        </div>
        <ChevronDown className={`w-4 h-4 shrink-0 text-gray-400 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div className="px-4 pb-4 pt-3 border-t border-gray-100 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-4 gap-y-3">
          <label className="text-[11px]">
            <span className="block text-gray-500 mb-1">손잡이 방식</span>
            <select
              className={inputCls}
              value={orderEntity.doorOption.handleType}
              onChange={(e) =>
                set({ doorOption: { ...orderEntity.doorOption, handleType: e.target.value as OrderEntity['doorOption']['handleType'] } })
              }
            >
              <option value="C_CHANNEL">C찬넬 핸들리스</option>
              <option value="NECK_CHANNEL">목찬넬 핸들리스</option>
              <option value="PUSH_OPEN">푸시 철물</option>
              <option value="HANDLE">돌출 손잡이</option>
            </select>
          </label>

          <label className="text-[11px]">
            <span className="block text-gray-500 mb-1">엣지 마감</span>
            <input className={inputCls} value={orderEntity.doorOption.edgeFinish} onChange={(e) => set({ doorOption: { ...orderEntity.doorOption, edgeFinish: e.target.value } })} />
          </label>

          <label className="text-[11px]">
            <span className="block text-gray-500 mb-1">싱크볼</span>
            <input className={inputCls} value={orderEntity.appliances.sinkBowlModel} onChange={(e) => set({ appliances: { ...orderEntity.appliances, sinkBowlModel: e.target.value } })} />
          </label>

          <label className="text-[11px]">
            <span className="block text-gray-500 mb-1">수전</span>
            <input className={inputCls} value={orderEntity.appliances.faucetModel} onChange={(e) => set({ appliances: { ...orderEntity.appliances, faucetModel: e.target.value } })} />
          </label>

          <label className="text-[11px]">
            <span className="block text-gray-500 mb-1">후드</span>
            <input className={inputCls} value={orderEntity.appliances.hoodModel} onChange={(e) => set({ appliances: { ...orderEntity.appliances, hoodModel: e.target.value } })} />
          </label>

          <div className="text-[11px]">
            <span className="block text-gray-500 mb-1">양중 / 현장 조건</span>
            <div className="flex items-center gap-4 pt-1.5">
              <label className="flex items-center gap-1.5 cursor-pointer text-gray-700 font-medium">
                <input
                  type="checkbox"
                  className="w-3.5 h-3.5 rounded text-blue-600"
                  checked={orderEntity.siteConditions.hasElevator}
                  onChange={(e) => set({ siteConditions: { ...orderEntity.siteConditions, hasElevator: e.target.checked } })}
                />
                엘리베이터
              </label>
              <label className="flex items-center gap-1.5 cursor-pointer text-gray-700 font-medium">
                <input
                  type="checkbox"
                  className="w-3.5 h-3.5 rounded text-blue-600"
                  checked={orderEntity.siteConditions.needsLadderTruck}
                  onChange={(e) => set({ siteConditions: { ...orderEntity.siteConditions, needsLadderTruck: e.target.checked } })}
                />
                사다리차
              </label>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
