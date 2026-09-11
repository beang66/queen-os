import { useState } from 'react';
import { Routes, Route, Navigate, useNavigate, useSearchParams } from 'react-router-dom';
import { Header } from './components/Header';
import { QuoteWizard } from './components/QuoteWizard';
import { PricingDbManager } from './components/PricingDbManager';
import { QuoteHistoryAudit } from './components/QuoteHistoryAudit';
import { SystemDiagram } from './components/SystemDiagram';
import { ParseAccuracyDashboard } from './components/ParseAccuracyDashboard';
import { ToastNotification } from './components/common/ToastNotification';
import { LoginPage } from './components/LoginPage';
import { useAuth } from './hooks/useAuth';
import { ParsedPriceItem, PricingItem, QuoteDocument, QuoteStatus } from './types';
import { queryClient } from './lib/queryClient';
import {
  usePricingItems,
  useAddPricingItem,
  useUpdatePricingItem,
  useDeletePricingItem,
  useBulkPricingItems,
  useResetPricingSeed,
  useQuotes,
  useSaveQuote,
  useUpdateQuote,
  useDeleteQuote,
  QUOTES_QUERY_KEY,
} from './hooks/queries';

/**
 * 퀸 주방가구 스마트 견적 & 원가 자동화 시스템 (Queen-OS) 메인 앱 컴포넌트
 *
 * 라우팅 및 상태 관리:
 * - React Router 기반 URL 네비게이션 (새로고침 시 탭 유지, 뒤로가기/앞으로가기 지원)
 * - 로고 클릭 시 메인페이지(/) 이동
 * - 특정 견적서 공유 링크 지원 (/quotes/:id)
 * - TanStack Query 기반 API 캐싱 & 낙관적 업데이트
 */
export default function App() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [resumeDraftId, setResumeDraftId] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // 세션 확인 중 — 로그인 화면이 깜빡이지 않도록 빈 화면을 보여줍니다.
  if (loading) return null;

  // 비로그인 상태이면 로그인 페이지로
  if (!user) return <LoginPage />;

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage(null);
    }, 4000);
  };

  // ---------------------------------------------------------------------------
  // 1. TanStack Query 데이터 페칭 (캐시 및 실시간 동기화)
  // ---------------------------------------------------------------------------
  const { data: pricingItems = [] } = usePricingItems();
  const { data: quotes = [] } = useQuotes();

  // 단가표 관련 뮤테이션
  const addPricingItemMutation = useAddPricingItem();
  const updatePricingItemMutation = useUpdatePricingItem();
  const deletePricingItemMutation = useDeletePricingItem();
  const bulkPricingMutation = useBulkPricingItems();
  const resetSeedMutation = useResetPricingSeed();

  // 견적서 관련 뮤테이션
  const saveQuoteMutation = useSaveQuote();
  const updateQuoteMutation = useUpdateQuote();
  const deleteQuoteMutation = useDeleteQuote();

  // ---------------------------------------------------------------------------
  // 2. 이벤트 핸들러
  // ---------------------------------------------------------------------------

  // 단가 품목 신규 등록
  const handleAddPricingItem = async (item: Omit<PricingItem, 'id' | 'updatedAt'>) => {
    try {
      await addPricingItemMutation.mutateAsync(item);
      showToast(`'${item.name}' 품목이 단가표에 등록되었습니다.`);
    } catch (err: any) {
      alert(`단가 등록 오류: ${err.message}`);
    }
  };

  // 단가 품목 수정 (낙관적 업데이트)
  const handleUpdatePricingItem = async (id: string, updates: Partial<PricingItem>) => {
    try {
      await updatePricingItemMutation.mutateAsync({ id, updates });
      showToast('단가 정보가 성공적으로 수정되었습니다.');
    } catch (err: any) {
      alert(`단가 수정 오류: ${err.message}`);
    }
  };

  // 단가 품목 삭제 (낙관적 삭제)
  const handleDeletePricingItem = async (id: string) => {
    try {
      await deletePricingItemMutation.mutateAsync(id);
      showToast('단가 품목이 삭제되었습니다.');
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
        stockStatus: 'INSTOCK' as const,
        notes: 'AI 문서 파싱 일괄 등록',
      }));

      await bulkPricingMutation.mutateAsync(formattedItems);
      showToast(`총 ${items.length}개 품목이 단가표 DB에 성공적으로 적재되었습니다.`);
    } catch (err: any) {
      alert(`일괄 저장 오류: ${err.message}`);
    }
  };

  // 표준 카탈로그 초기화
  const handleResetSeed = async () => {
    if (!confirm('퀸 주방가구 표준 단가표 카탈로그(기본 품목)로 초기화하시겠습니까?')) return;
    try {
      await resetSeedMutation.mutateAsync();
      showToast('퀸 주방가구 표준 단가표 카탈로그로 초기화되었습니다.');
    } catch (err: any) {
      alert(`초기화 오류: ${err.message}`);
    }
  };

  // 영구 견적서 저장 및 발행
  const handleSaveQuote = async (payload: any): Promise<QuoteDocument> => {
    const res = await saveQuoteMutation.mutateAsync(payload);
    showToast(`견적서 #${res.data.quoteNumber}가 발행/저장되었습니다.`);
    return res.data;
  };

  // 견적서 이력 상태 변경
  const handleUpdateQuoteStatus = async (id: string, status: QuoteStatus) => {
    try {
      await updateQuoteMutation.mutateAsync({ id, updates: { status } });
      showToast('견적 진행 상태가 업데이트되었습니다.');
    } catch (err: any) {
      alert(`상태 변경 오류: ${err.message}`);
    }
  };

  // 견적서 삭제 (낙관적 삭제)
  const handleDeleteQuote = async (id: string) => {
    try {
      await deleteQuoteMutation.mutateAsync(id);
      showToast('견적서가 삭제되었습니다.');
    } catch (err: any) {
      alert(`견적서 삭제 오류: ${err.message}`);
    }
  };

  return (
    <div className="min-h-screen bg-[#f0f2f5] text-[#1a1a1a] flex flex-col font-sans antialiased">
      {/* Toast Notification */}
      <ToastNotification message={toastMessage} />

      {/* Global Header — 로고 클릭 시 '/' 이동 및 NavLink 탭 동기화 */}
      <Header
        pricingCount={pricingItems.length}
        quotesCount={quotes.length}
      />

      {/* Main Content Area — React Router Routes */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-3 sm:px-5 lg:px-6 py-4">
        <Routes>
          {/* 1. 신규 견적 작성 (메인) */}
          <Route
            path="/"
            element={
              <QuoteWizard
                pricingItems={pricingItems}
                onSaveQuote={handleSaveQuote}
                onNavigateToHistory={() => navigate('/history')}
                resumeDraftId={resumeDraftId || searchParams.get('draftId')}
                onResumeHandled={() => {
                  setResumeDraftId(null);
                  if (searchParams.get('draftId')) {
                    setSearchParams({});
                  }
                }}
              />
            }
          />
          <Route path="/wizard" element={<Navigate to="/" replace />} />

          {/* 2. 단가표 관리 */}
          <Route
            path="/pricing"
            element={
              <PricingDbManager
                items={pricingItems}
                onAddItem={handleAddPricingItem}
                onUpdateItem={handleUpdatePricingItem}
                onDeleteItem={handleDeletePricingItem}
                onResetSeed={handleResetSeed}
                onApplyBulkItems={handleApplyToPricingDb}
              />
            }
          />

          {/* 3. 견적 관리 및 견적서 공유 링크 (/quotes/:id) */}
          <Route
            path="/history"
            element={
              <QuoteHistoryAudit
                quotes={quotes}
                onRefresh={async () => {
                  await queryClient.invalidateQueries({ queryKey: QUOTES_QUERY_KEY });
                }}
                onUpdateStatus={handleUpdateQuoteStatus}
                onDeleteQuote={handleDeleteQuote}
                onResumeDraft={(id) => {
                  navigate(`/?draftId=${id}`);
                }}
              />
            }
          />
          <Route
            path="/quotes/:id"
            element={
              <QuoteHistoryAudit
                quotes={quotes}
                onRefresh={async () => {
                  await queryClient.invalidateQueries({ queryKey: QUOTES_QUERY_KEY });
                }}
                onUpdateStatus={handleUpdateQuoteStatus}
                onDeleteQuote={handleDeleteQuote}
                onResumeDraft={(id) => {
                  navigate(`/?draftId=${id}`);
                }}
              />
            }
          />

          {/* 4. AI 파싱 정확도 대시보드 */}
          <Route path="/ai-accuracy" element={<ParseAccuracyDashboard />} />

          {/* 5. 시스템 아키텍처 다이어그램 */}
          <Route path="/architecture" element={<SystemDiagram />} />

          {/* 6. Fallback */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
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
