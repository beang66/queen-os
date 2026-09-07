import React, { useState, useEffect } from 'react';
import { Header } from './components/Header';
import { QuoteWizard } from './components/QuoteWizard';
import { PricingDbManager } from './components/PricingDbManager';
import { QuoteHistoryAudit } from './components/QuoteHistoryAudit';
import { SystemDiagram } from './components/SystemDiagram';
import { ToastNotification } from './components/common/ToastNotification';
import { OrderEntity, ParsedPriceItem, PricingItem, QuoteDocument, QuoteStatus } from './types';

/**
 * 퀸 주방가구 스마트 견적 & 원가 자동화 시스템 (Queen-OS) 메인 앱 컴포넌트
 */
export default function App() {
  const [activeTab, setActiveTab] = useState<'wizard' | 'extract' | 'pricing' | 'history' | 'architecture'>('wizard');
  const [draftOrderEntity, setDraftOrderEntity] = useState<OrderEntity | null>(null);
  const [pricingItems, setPricingItems] = useState<PricingItem[]>([]);
  const [quotes, setQuotes] = useState<QuoteDocument[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage(null);
    }, 4000);
  };

  // 단가표 DB 데이터 조회 API
  const fetchPricingItems = async () => {
    try {
      const res = await fetch('/api/pricing');
      const data = await res.json();
      if (data.success) {
        setPricingItems(data.data);
      }
    } catch (err) {
      console.error('Failed to fetch pricing items:', err);
    }
  };

  // 발행된 견적서 이력 조회 API
  const fetchQuotes = async () => {
    try {
      const res = await fetch('/api/quotes');
      const data = await res.json();
      if (data.success) {
        setQuotes(data.data);
      }
    } catch (err) {
      console.error('Failed to fetch quotes:', err);
    }
  };

  useEffect(() => {
    const init = async () => {
      setLoading(true);
      await Promise.all([fetchPricingItems(), fetchQuotes()]);
      setLoading(false);
    };
    init();
  }, []);

  // 단가 품목 신규 등록
  const handleAddPricingItem = async (item: Omit<PricingItem, 'id' | 'updatedAt'>) => {
    try {
      const res = await fetch('/api/pricing', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(item),
      });
      const data = await res.json();
      if (data.success) {
        await fetchPricingItems();
        showToast(`'${item.name}' 품목이 단가표에 등록되었습니다.`);
      } else {
        alert(data.error || '등록 실패');
      }
    } catch (err: any) {
      alert(`단가 등록 오류: ${err.message}`);
    }
  };

  // 단가 품목 수정
  const handleUpdatePricingItem = async (id: string, updates: Partial<PricingItem>) => {
    try {
      const res = await fetch(`/api/pricing/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates),
      });
      const data = await res.json();
      if (data.success) {
        await fetchPricingItems();
        showToast('단가 정보가 성공적으로 수정되었습니다.');
      } else {
        alert(data.error || '수정 실패');
      }
    } catch (err: any) {
      alert(`단가 수정 오류: ${err.message}`);
    }
  };

  // 단가 품목 삭제
  const handleDeletePricingItem = async (id: string) => {
    try {
      const res = await fetch(`/api/pricing/${id}`, {
        method: 'DELETE',
      });
      const data = await res.json();
      if (data.success) {
        await fetchPricingItems();
        showToast('단가 품목이 삭제되었습니다.');
      }
    } catch (err: any) {
      alert(`삭제 오류: ${err.message}`);
    }
  };

  // AI 파싱된 단가 품목 일괄 저장
  const handleApplyToPricingDb = async (items: ParsedPriceItem[]) => {
    try {
      const formattedItems = items.map((i) => ({
        code: i.code || `ITEM-${Date.now().toString().slice(-4)}`,
        category: i.category || 'ACCESSORY',
        name: i.name,
        spec: i.spec || '',
        material: i.material || '',
        unit: i.unit || 'm',
        costPrice: i.costPrice || 0,
        sellingPrice: i.sellingPrice || 0,
        supplier: i.supplier || '퀸 퍼니처',
        stockStatus: 'INSTOCK',
        notes: 'AI 문서 파싱 일괄 등록',
      }));

      const res = await fetch('/api/pricing/bulk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items: formattedItems }),
      });
      const data = await res.json();
      if (data.success) {
        await fetchPricingItems();
        showToast(`총 ${items.length}개 품목이 단가표 DB에 성공적으로 적재되었습니다.`);
      } else {
        alert(data.error || '일괄 저장 실패');
      }
    } catch (err: any) {
      alert(`일괄 저장 오류: ${err.message}`);
    }
  };

  // 표준 카탈로그 초기화
  const handleResetSeed = async () => {
    if (!confirm('퀸 주방가구 표준 단가표 카탈로그(기본 품목)로 초기화하시겠습니까?')) return;
    try {
      const res = await fetch('/api/pricing/reset-seed', { method: 'POST' });
      const data = await res.json();
      if (data.success) {
        await fetchPricingItems();
        showToast('퀸 주방가구 표준 단가표 카탈로그로 초기화되었습니다.');
      }
    } catch (err: any) {
      alert(`초기화 오류: ${err.message}`);
    }
  };

  // 영구 견적서 저장
  const handleSaveQuote = async (payload: {
    title: string;
    targetMarginRate: number;
    orderEntity: any;
    calculationResult: any;
    notes?: string;
  }): Promise<QuoteDocument> => {
    const res = await fetch('/api/quotes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (data.success && data.data) {
      await fetchQuotes();
      showToast(`견적서 #${data.data.quoteNumber}가 영구 저장되었습니다.`);
      return data.data;
    } else {
      throw new Error(data.error || '견적서 저장 실패');
    }
  };

  // 견적서 이력 상태 변경
  const handleUpdateQuoteStatus = async (id: string, status: QuoteStatus) => {
    try {
      const res = await fetch(`/api/quotes/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      });
      const data = await res.json();
      if (data.success) {
        await fetchQuotes();
        showToast('견적 진행 상태가 업데이트되었습니다.');
      }
    } catch (err: any) {
      alert(`상태 변경 오류: ${err.message}`);
    }
  };

  // 견적서 삭제
  const handleDeleteQuote = async (id: string) => {
    try {
      const res = await fetch(`/api/quotes/${id}`, { method: 'DELETE' });
      const data = await res.json();
      if (data.success) {
        await fetchQuotes();
        showToast('견적서가 삭제되었습니다.');
      }
    } catch (err: any) {
      alert(`견적서 삭제 오류: ${err.message}`);
    }
  };

  return (
    <div className="min-h-screen bg-[#f0f2f5] text-[#1a1a1a] flex flex-col font-sans antialiased">
      {/* Toast Notification */}
      <ToastNotification message={toastMessage} />

      {/* Global Header */}
      <Header
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        pricingCount={pricingItems.length}
        quotesCount={quotes.length}
      />

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-3 sm:px-5 lg:px-6 py-4">
        {activeTab === 'wizard' && (
          <QuoteWizard
            initialOrderEntity={draftOrderEntity}
            onSaveQuote={handleSaveQuote}
            onNavigateToHistory={() => setActiveTab('history')}
          />
        )}

        {activeTab === 'pricing' && (
          <PricingDbManager
            items={pricingItems}
            onRefresh={fetchPricingItems}
            onAddItem={handleAddPricingItem}
            onUpdateItem={handleUpdatePricingItem}
            onDeleteItem={handleDeletePricingItem}
            onResetSeed={handleResetSeed}
            onApplyBulkItems={handleApplyToPricingDb}
          />
        )}

        {activeTab === 'history' && (
          <QuoteHistoryAudit
            quotes={quotes}
            onRefresh={fetchQuotes}
            onUpdateStatus={handleUpdateQuoteStatus}
            onDeleteQuote={handleDeleteQuote}
          />
        )}

        {activeTab === 'architecture' && <SystemDiagram />}
      </main>

      {/* Footer */}
      <footer className="bg-white border-t border-gray-200 py-3 text-xs text-gray-500">
        <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-gray-700">QUEEN KITCHEN SYSTEM</span>
            <span className="text-gray-300">|</span>
            <span>퀸 주방가구 스마트 견적 & 원가 자동화 시스템</span>
          </div>
          <div className="font-mono text-[11px] text-gray-500 flex items-center gap-3">
            <span className="text-blue-600 font-semibold">GEMINI 3.7 FLASH</span>
            <span>·</span>
            <span className="text-green-600 font-semibold">DETERMINISTIC 100% FORMULA</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
