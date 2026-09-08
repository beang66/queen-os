import React, { useState } from 'react';
import { Refrigerator, Plus, Pencil, Trash2, GripVertical, Link2, CheckCircle2, AlertTriangle, Info } from 'lucide-react';
import { PricingItem, ReviewLineItem } from '../../../types';
import { STATUS_META, UNIT_OPTIONS, createBlankItem } from './reviewModel';

interface KitchenItemsTableProps {
  items: ReviewLineItem[];
  setItems: React.Dispatch<React.SetStateAction<ReviewLineItem[]>>;
  pricingItems: PricingItem[];
}

const StatusIcon: React.FC<{ status: ReviewLineItem['status'] }> = ({ status }) => {
  if (status === 'CONFIRMED') return <CheckCircle2 className="w-3 h-3" />;
  if (status === 'NEEDS_PRICING') return <AlertTriangle className="w-3 h-3" />;
  return <Info className="w-3 h-3" />;
};

/**
 * 규격 검수 - 주방 구성 품목 테이블
 * 품목 추가·삭제, 순서 변경, 규격/수량/단위 확정, 단가 DB 품목 연결을 담당합니다.
 */
export const KitchenItemsTable: React.FC<KitchenItemsTableProps> = ({ items, setItems, pricingItems }) => {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [dragId, setDragId] = useState<string | null>(null);

  const update = (id: string, patch: Partial<ReviewLineItem>) =>
    setItems((prev) => prev.map((i) => (i.id === id ? { ...i, ...patch } : i)));

  const remove = (id: string) => {
    setItems((prev) => prev.filter((i) => i.id !== id));
    if (editingId === id) setEditingId(null);
  };

  const add = () =>
    setItems((prev) => {
      const next = createBlankItem(prev.length + 1);
      setEditingId(next.id);
      return [...prev, next];
    });

  const linkPricing = (id: string, pricingId: string) =>
    update(id, pricingId ? { linkedPricingId: pricingId, status: 'CONFIRMED' } : { linkedPricingId: null, status: 'NEEDS_PRICING' });

  const handleDrop = (targetId: string) => {
    if (!dragId || dragId === targetId) return;
    setItems((prev) => {
      const from = prev.findIndex((i) => i.id === dragId);
      const to = prev.findIndex((i) => i.id === targetId);
      if (from < 0 || to < 0) return prev;
      const next = [...prev];
      const [moved] = next.splice(from, 1);
      next.splice(to, 0, moved);
      return next;
    });
    setDragId(null);
  };

  const cellInput =
    'w-full rounded-lg border border-gray-200 bg-white px-2.5 py-1.5 text-xs text-gray-800 focus:border-blue-500 focus:outline-none';

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4 space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-1.5">
          <Refrigerator className="w-4 h-4 text-gray-500 mt-0.5" />
          <div>
            <h4 className="text-xs font-bold text-gray-800">주방 구성 품목</h4>
            <p className="text-[11px] text-gray-500 mt-0.5">추출된 품목과 규격을 확인하고 수량을 조정하세요.</p>
          </div>
        </div>
        <button
          type="button"
          onClick={add}
          className="shrink-0 flex items-center gap-1 rounded-lg border border-gray-200 hover:border-blue-400 bg-white px-2.5 py-1.5 text-[11px] font-bold text-gray-600 hover:text-blue-600 transition-colors"
        >
          <Plus className="w-3.5 h-3.5" />
          품목 추가
        </button>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs border-collapse min-w-[760px]">
          <thead>
            <tr className="bg-slate-50 text-gray-500">
              <th className="w-7 py-2 px-1 rounded-l-lg" />
              <th className="py-2 px-2 font-semibold w-40">품목</th>
              <th className="py-2 px-2 font-semibold">규격 / 산출 기준</th>
              <th className="py-2 px-2 font-semibold w-28">수량</th>
              <th className="py-2 px-2 font-semibold w-24">단위</th>
              <th className="py-2 px-2 font-semibold w-32">상태</th>
              <th className="py-2 px-2 font-semibold w-20 text-center rounded-r-lg">관리</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {items.map((it) => {
              const meta = STATUS_META[it.status];
              const linkable = pricingItems.filter((p) => p.category === it.category);
              const isEditing = editingId === it.id;

              return (
                <React.Fragment key={it.id}>
                  <tr
                    draggable
                    onDragStart={() => setDragId(it.id)}
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={() => handleDrop(it.id)}
                    className={`hover:bg-slate-50/70 ${dragId === it.id ? 'opacity-40' : ''}`}
                  >
                    <td className="py-1.5 px-1 text-gray-300 cursor-grab active:cursor-grabbing">
                      <GripVertical className="w-3.5 h-3.5" />
                    </td>
                    <td className="py-1.5 px-2">
                      <input className={cellInput} value={it.name} placeholder="품목명" onChange={(e) => update(it.id, { name: e.target.value, source: 'MANUAL' })} />
                    </td>
                    <td className="py-1.5 px-2">
                      <input className={cellInput} value={it.spec} placeholder="규격 / 산출 기준" onChange={(e) => update(it.id, { spec: e.target.value, source: 'MANUAL' })} />
                    </td>
                    <td className="py-1.5 px-2">
                      <input
                        type="number"
                        className={`${cellInput} font-mono font-semibold`}
                        value={it.quantity}
                        onChange={(e) => update(it.id, { quantity: Number(e.target.value) })}
                      />
                    </td>
                    <td className="py-1.5 px-2">
                      <select className={cellInput} value={it.unit} onChange={(e) => update(it.id, { unit: e.target.value })}>
                        {UNIT_OPTIONS.map((u) => (
                          <option key={u} value={u}>{u}</option>
                        ))}
                      </select>
                    </td>
                    <td className="py-1.5 px-2">
                      <button
                        type="button"
                        onClick={() => setEditingId(isEditing ? null : it.id)}
                        className={`inline-flex items-center gap-1 rounded-md border px-1.5 py-1 text-[10px] font-bold ${meta.cls}`}
                        title="상태 및 단가 연결 편집"
                      >
                        <StatusIcon status={it.status} />
                        {meta.label}
                      </button>
                    </td>
                    <td className="py-1.5 px-2">
                      <div className="flex items-center justify-center gap-2 text-gray-400">
                        <button type="button" title="상세 편집" onClick={() => setEditingId(isEditing ? null : it.id)} className="hover:text-blue-600">
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                        <button type="button" title="삭제" onClick={() => remove(it.id)} className="hover:text-red-500">
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>

                  {isEditing && (
                    <tr className="bg-slate-50/80">
                      <td />
                      <td colSpan={6} className="py-2.5 px-2">
                        <div className="flex flex-col sm:flex-row sm:items-end gap-3">
                          <label className="text-[11px] sm:w-48">
                            <span className="block text-gray-500 mb-1">카테고리</span>
                            <select
                              className={cellInput}
                              value={it.category}
                              onChange={(e) => update(it.id, { category: e.target.value as ReviewLineItem['category'], linkedPricingId: null })}
                            >
                              <option value="CARCASS">캐비닛/몸통</option>
                              <option value="DOOR">도어/마감재</option>
                              <option value="COUNTERTOP">상판/인조대리석</option>
                              <option value="HARDWARE">하드웨어</option>
                              <option value="APPLIANCE">기기/싱크볼/수전</option>
                              <option value="LABOR">시공 및 가공비</option>
                              <option value="ACCESSORY">부자재/기타</option>
                            </select>
                          </label>

                          <label className="text-[11px] flex-1">
                            <span className="flex items-center gap-1 text-gray-500 mb-1">
                              <Link2 className="w-3 h-3" /> 단가 DB 품목 연결
                            </span>
                            <select
                              className={`${cellInput} ${it.linkedPricingId ? '' : 'border-orange-300 bg-orange-50/40 text-orange-700'}`}
                              value={it.linkedPricingId ?? ''}
                              onChange={(e) => linkPricing(it.id, e.target.value)}
                            >
                              <option value="">
                                {linkable.length ? '단가 DB 품목을 선택하세요' : '해당 카테고리의 단가 품목이 없습니다'}
                              </option>
                              {linkable.map((p) => (
                                <option key={p.id} value={p.id}>
                                  {p.code} · {p.name} ({p.sellingPrice.toLocaleString()}원/{p.unit})
                                </option>
                              ))}
                            </select>
                          </label>

                          <label className="text-[11px] flex items-center gap-1.5 pb-2 whitespace-nowrap cursor-pointer">
                            <input
                              type="checkbox"
                              className="w-3.5 h-3.5 rounded text-blue-600"
                              checked={it.status === 'MANUAL'}
                              onChange={(e) =>
                                update(it.id, {
                                  status: e.target.checked ? 'MANUAL' : it.linkedPricingId ? 'CONFIRMED' : 'NEEDS_PRICING',
                                })
                              }
                            />
                            <span className="text-gray-600 font-medium">직접 입력 항목 (단가 연결 제외)</span>
                          </label>
                        </div>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              );
            })}

            {items.length === 0 && (
              <tr>
                <td colSpan={7} className="py-8 text-center text-xs text-gray-400">
                  구성 품목이 없습니다. '품목 추가'로 직접 입력하세요.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};
