import React, { useState, useMemo } from 'react';
import { PricingFilterBar } from './pricing/PricingFilterBar';
import { PricingItemTable } from './pricing/PricingItemTable';
import { PricingItemModal } from './pricing/PricingItemModal';
import { DocumentExtractor } from './DocumentExtractor';
import { PricingItem, ParsedPriceItem } from '../types';
import { X, Sparkles } from 'lucide-react';

interface PricingDbManagerProps {
  items: PricingItem[];
  onAddItem: (item: Omit<PricingItem, 'id' | 'updatedAt'>) => Promise<void>;
  onUpdateItem: (id: string, updates: Partial<PricingItem>) => Promise<void>;
  onDeleteItem: (id: string) => Promise<void>;
  onResetSeed: () => Promise<void>;
  onApplyBulkItems?: (items: ParsedPriceItem[]) => Promise<void>;
}

/**
 * 퀸 주방가구 단가표 DB 관리 (PricingDbManager) 메인 컨테이너 컴포넌트
 */
export const PricingDbManager: React.FC<PricingDbManagerProps> = ({
  items,
  onAddItem,
  onUpdateItem,
  onDeleteItem,
  onResetSeed,
  onApplyBulkItems,
}) => {
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [editingItem, setEditingItem] = useState<PricingItem | null>(null);
  const [isExtractorModalOpen, setIsExtractorModalOpen] = useState<boolean>(false);

  // 카테고리 고유 리스트 추출
  const categories = useMemo(() => {
    const set = new Set(items.map((i) => i.category));
    return ['ALL', ...Array.from(set)];
  }, [items]);

  // 필터링된 단가 목록
  const filteredItems = useMemo(() => {
    return items.filter((item) => {
      const matchCat = selectedCategory === 'ALL' || item.category === selectedCategory;
      const q = searchQuery.toLowerCase();
      const matchSearch =
        !q ||
        item.name.toLowerCase().includes(q) ||
        item.code.toLowerCase().includes(q) ||
        (item.material && item.material.toLowerCase().includes(q)) ||
        item.supplier.toLowerCase().includes(q);
      return matchCat && matchSearch;
    });
  }, [items, selectedCategory, searchQuery]);

  const handleOpenAddModal = () => {
    setEditingItem(null);
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (item: PricingItem) => {
    setEditingItem(item);
    setIsModalOpen(true);
  };

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* 1. 검색 및 필터 컨트롤 바 */}
      <PricingFilterBar
        searchQuery={searchQuery}
        setSearchQuery={setSearchQuery}
        selectedCategory={selectedCategory}
        setSelectedCategory={setSelectedCategory}
        categories={categories}
        totalCount={filteredItems.length}
        onOpenAddModal={handleOpenAddModal}
        onResetSeed={onResetSeed}
        onOpenAiExtractor={() => setIsExtractorModalOpen(true)}
      />

      {/* 2. 단가표 목록 테이블 */}
      <PricingItemTable
        items={filteredItems}
        onEdit={handleOpenEditModal}
        onDelete={onDeleteItem}
      />

      {/* 3. 품목 추가/수정 모달 */}
      <PricingItemModal
        isOpen={isModalOpen}
        editingItem={editingItem}
        onClose={() => setIsModalOpen(false)}
        onSave={onAddItem}
        onUpdate={onUpdateItem}
      />

      {/* 4. AI 단가표 문서 추출 및 일괄 적재 모달 */}
      {isExtractorModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-2xl max-w-5xl w-full max-h-[90vh] flex flex-col overflow-hidden border border-gray-200 animate-in fade-in zoom-in-95 duration-200">
            {/* 모달 헤더 */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 bg-gradient-to-r from-purple-50 to-blue-50">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-purple-600 rounded-lg text-white shadow-xs">
                  <Sparkles className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-gray-900">
                    AI 단가표 문서 자동 추출 & DB 일괄 적재
                  </h3>
                  <p className="text-xs text-gray-500">
                    거래처 단가표 이미지나 PDF를 분석하여 시스템 단가표 DB에 한 번에 등록합니다.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsExtractorModalOpen(false)}
                className="p-1.5 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* 모달 바디: DocumentExtractor 컴포넌트 내장 */}
            <div className="p-6 overflow-y-auto flex-1 bg-[#f8fafc]">
              <DocumentExtractor
                onApplyToPricingDb={async (bulkItems) => {
                  if (onApplyBulkItems) {
                    await onApplyBulkItems(bulkItems);
                  }
                  setIsExtractorModalOpen(false);
                }}
                onTransferToQuote={() => {
                  setIsExtractorModalOpen(false);
                  alert('발주서 추출 데이터는 [신규 견적] 탭에서 사용해주세요.');
                }}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
