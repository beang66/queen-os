import React, { useState, useEffect } from 'react';
import { X, Save } from 'lucide-react';
import { PricingItem } from '../../types';

interface PricingItemModalProps {
  isOpen: boolean;
  editingItem: PricingItem | null;
  onClose: () => void;
  onSave: (item: Omit<PricingItem, 'id' | 'updatedAt'>) => void;
  onUpdate: (id: string, updates: Partial<PricingItem>) => void;
}

/**
 * 신규 단가 품목 추가 / 기존 단가 수정 팝업 모달 컴포넌트
 */
export const PricingItemModal: React.FC<PricingItemModalProps> = ({
  isOpen,
  editingItem,
  onClose,
  onSave,
  onUpdate,
}) => {
  const [formData, setFormData] = useState<Omit<PricingItem, 'id' | 'updatedAt'>>({
    code: '',
    category: 'DOOR',
    name: '',
    spec: '',
    material: '',
    unit: 'm',
    costPrice: 0,
    sellingPrice: 0,
    supplier: '퀸 퍼니처',
    stockStatus: 'INSTOCK',
    notes: '',
  });

  useEffect(() => {
    if (editingItem) {
      setFormData({
        code: editingItem.code,
        category: editingItem.category,
        name: editingItem.name,
        spec: editingItem.spec,
        material: editingItem.material,
        unit: editingItem.unit,
        costPrice: editingItem.costPrice,
        sellingPrice: editingItem.sellingPrice,
        supplier: editingItem.supplier,
        stockStatus: editingItem.stockStatus,
        notes: editingItem.notes || '',
      });
    } else {
      setFormData({
        code: `ITEM-${Date.now().toString().slice(-4)}`,
        category: 'DOOR',
        name: '',
        spec: '',
        material: '',
        unit: 'm',
        costPrice: 0,
        sellingPrice: 0,
        supplier: '퀸 퍼니처',
        stockStatus: 'INSTOCK',
        notes: '',
      });
    }
  }, [editingItem, isOpen]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (editingItem) {
      onUpdate(editingItem.id, formData);
    } else {
      onSave(formData);
    }
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-2xl max-w-lg w-full overflow-hidden animate-in fade-in zoom-in duration-200">
        <div className="bg-gray-900 text-white px-5 py-4 flex items-center justify-between">
          <h3 className="text-sm font-bold">
            {editingItem ? '단가 품목 정보 수정' : '신규 단가 품목 추가'}
          </h3>
          <button
            type="button"
            onClick={onClose}
            className="text-gray-400 hover:text-white p-1 rounded transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4 text-xs">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-gray-600 font-medium mb-1">품목 코드</label>
              <input
                type="text"
                value={formData.code}
                onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                className="w-full border border-gray-300 rounded px-2.5 py-1.5 font-mono"
                required
              />
            </div>
            <div>
              <label className="block text-gray-600 font-medium mb-1">카테고리</label>
              <select
                value={formData.category}
                onChange={(e) => setFormData({ ...formData, category: e.target.value as any })}
                className="w-full border border-gray-300 rounded px-2.5 py-1.5"
              >
                <option value="DOOR">DOOR (도어)</option>
                <option value="BODY">BODY (몸통/캐비닛)</option>
                <option value="COUNTERTOP">COUNTERTOP (인조대리석/상판)</option>
                <option value="HARDWARE">HARDWARE (수전/싱크볼)</option>
                <option value="APPLIANCE">APPLIANCE (후드/인덕션)</option>
                <option value="LABOR">LABOR (시공/운반비)</option>
                <option value="ACCESSORY">ACCESSORY (기타 악세서리)</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-gray-600 font-medium mb-1">품목명</label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="w-full border border-gray-300 rounded px-2.5 py-1.5 font-bold"
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-gray-600 font-medium mb-1">규격 (Spec)</label>
              <input
                type="text"
                value={formData.spec}
                onChange={(e) => setFormData({ ...formData, spec: e.target.value })}
                className="w-full border border-gray-300 rounded px-2.5 py-1.5"
              />
            </div>
            <div>
              <label className="block text-gray-600 font-medium mb-1">재질 (Material)</label>
              <input
                type="text"
                value={formData.material}
                onChange={(e) => setFormData({ ...formData, material: e.target.value })}
                className="w-full border border-gray-300 rounded px-2.5 py-1.5"
              />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-gray-600 font-medium mb-1">단위</label>
              <input
                type="text"
                value={formData.unit}
                onChange={(e) => setFormData({ ...formData, unit: e.target.value })}
                className="w-full border border-gray-300 rounded px-2.5 py-1.5 text-center"
                required
              />
            </div>
            <div>
              <label className="block text-gray-600 font-medium mb-1">매입 원가 (원)</label>
              <input
                type="number"
                value={formData.costPrice}
                onChange={(e) => setFormData({ ...formData, costPrice: Number(e.target.value) })}
                className="w-full border border-gray-300 rounded px-2.5 py-1.5 font-mono text-right"
                required
              />
            </div>
            <div>
              <label className="block text-gray-600 font-medium mb-1">표준 판매가 (원)</label>
              <input
                type="number"
                value={formData.sellingPrice}
                onChange={(e) => setFormData({ ...formData, sellingPrice: Number(e.target.value) })}
                className="w-full border border-gray-300 rounded px-2.5 py-1.5 font-mono text-right text-blue-600 font-bold"
                required
              />
            </div>
          </div>

          <div>
            <label className="block text-gray-600 font-medium mb-1">공급업체 / 제조사</label>
            <input
              type="text"
              value={formData.supplier}
              onChange={(e) => setFormData({ ...formData, supplier: e.target.value })}
              className="w-full border border-gray-300 rounded px-2.5 py-1.5"
            />
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t border-gray-100">
            <button
              type="button"
              onClick={onClose}
              className="border border-gray-300 hover:bg-gray-100 text-gray-700 font-medium px-4 py-2 rounded-lg text-xs"
            >
              취소
            </button>
            <button
              type="submit"
              className="bg-blue-600 hover:bg-blue-700 text-white font-medium px-5 py-2 rounded-lg text-xs flex items-center gap-1.5"
            >
              <Save className="w-3.5 h-3.5" />
              <span>저장</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
