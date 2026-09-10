import { useQuery, useMutation } from '@tanstack/react-query';
import { queryClient } from '../lib/queryClient';
import { fetchJson, fetchValidated } from '../lib/api';
import {
  PricingListResponse,
  QuoteListResponse,
  DraftListResponse,
  ParseAccuracyStatsResponse,
  ParseLogListResponse,
} from '../schemas';
import {
  PricingItem,
  QuoteDocument,
  QuoteDraftSummary,
  QuoteStatus,
  DraftStatus,
} from '../types';

// ===========================================================================
// 1. 단가표 (Pricing) 쿼리 및 뮤테이션
// ===========================================================================

export const PRICING_QUERY_KEY = ['pricing'] as const;
export const PRICING_FINGERPRINT_KEY = ['pricing', 'fingerprint'] as const;

/** 단가표 전체 목록 조회 훅 (5분 캐시) */
export function usePricingItems() {
  return useQuery({
    queryKey: PRICING_QUERY_KEY,
    queryFn: async () => {
      const res = await fetchValidated(PricingListResponse, '/api/pricing');
      return res.data;
    },
  });
}

/** 단가표 지문 해시 조회 훅 */
export function usePricingFingerprint() {
  return useQuery({
    queryKey: PRICING_FINGERPRINT_KEY,
    queryFn: async () => {
      const res = await fetchJson<{ success: boolean; data: { fingerprint: string } }>(
        '/api/pricing/fingerprint'
      );
      return res.data.fingerprint;
    },
  });
}

/** 단가 품목 신규 추가 */
export function useAddPricingItem() {
  return useMutation({
    mutationFn: async (item: Omit<PricingItem, 'id' | 'updatedAt'>) => {
      return fetchJson<{ success: boolean; data: PricingItem }>('/api/pricing', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(item),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: PRICING_QUERY_KEY });
      queryClient.invalidateQueries({ queryKey: PRICING_FINGERPRINT_KEY });
    },
  });
}

/** 단가 품목 정보 수정 (낙관적 업데이트 적용: 수정 즉시 UI 반영) */
export function useUpdatePricingItem() {
  return useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: Partial<PricingItem> }) => {
      return fetchJson<{ success: boolean; data: PricingItem }>(`/api/pricing/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates),
      });
    },
    onMutate: async ({ id, updates }) => {
      // 진행 중인 쿼리 취소
      await queryClient.cancelQueries({ queryKey: PRICING_QUERY_KEY });
      // 이전 캐시 스냅샷 백업
      const previousItems = queryClient.getQueryData<PricingItem[]>(PRICING_QUERY_KEY);

      // 캐시 낙관적 업데이트
      if (previousItems) {
        queryClient.setQueryData<PricingItem[]>(
          PRICING_QUERY_KEY,
          previousItems.map((item) => (item.id === id ? { ...item, ...updates } : item))
        );
      }
      return { previousItems };
    },
    onError: (_err, _variables, context) => {
      // 에러 발생 시 롤백
      if (context?.previousItems) {
        queryClient.setQueryData(PRICING_QUERY_KEY, context.previousItems);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: PRICING_QUERY_KEY });
      queryClient.invalidateQueries({ queryKey: PRICING_FINGERPRINT_KEY });
    },
  });
}

/** 단가 품목 삭제 (낙관적 삭제 적용: 즉시 목록에서 제거) */
export function useDeletePricingItem() {
  return useMutation({
    mutationFn: async (id: string) => {
      return fetchJson<{ success: boolean }>(`/api/pricing/${id}`, {
        method: 'DELETE',
      });
    },
    onMutate: async (id: string) => {
      await queryClient.cancelQueries({ queryKey: PRICING_QUERY_KEY });
      const previousItems = queryClient.getQueryData<PricingItem[]>(PRICING_QUERY_KEY);

      if (previousItems) {
        queryClient.setQueryData<PricingItem[]>(
          PRICING_QUERY_KEY,
          previousItems.filter((item) => item.id !== id)
        );
      }
      return { previousItems };
    },
    onError: (_err, _id, context) => {
      if (context?.previousItems) {
        queryClient.setQueryData(PRICING_QUERY_KEY, context.previousItems);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: PRICING_QUERY_KEY });
      queryClient.invalidateQueries({ queryKey: PRICING_FINGERPRINT_KEY });
    },
  });
}

/** 표준 단가 카탈로그 초기화 */
export function useResetPricingSeed() {
  return useMutation({
    mutationFn: async () => {
      return fetchJson<{ success: boolean; message: string; count: number }>('/api/pricing/reset-seed', {
        method: 'POST',
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: PRICING_QUERY_KEY });
      queryClient.invalidateQueries({ queryKey: PRICING_FINGERPRINT_KEY });
    },
  });
}

/** 단가 품목 대량 등록 */
export function useBulkPricingItems() {
  return useMutation({
    mutationFn: async (items: Array<Omit<PricingItem, 'id' | 'updatedAt'>>) => {
      return fetchJson<{ success: boolean; created: number; updated: number; currentTotal: number }>(
        '/api/pricing/bulk',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ items }),
        }
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: PRICING_QUERY_KEY });
      queryClient.invalidateQueries({ queryKey: PRICING_FINGERPRINT_KEY });
    },
  });
}

// ===========================================================================
// 2. 견적서 (Quotes) 쿼리 및 뮤테이션
// ===========================================================================

export const QUOTES_QUERY_KEY = ['quotes'] as const;

/** 발행된 견적서 목록 조회 훅 */
export function useQuotes(status?: string, search?: string) {
  return useQuery({
    queryKey: [...QUOTES_QUERY_KEY, { status, search }],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (status && status !== 'ALL') params.set('status', status);
      if (search) params.set('search', search);
      const url = `/api/quotes${params.toString() ? `?${params.toString()}` : ''}`;
      const res = await fetchValidated(QuoteListResponse, url);
      return res.data;
    },
  });
}

/** 견적서 발행 및 저장 */
export function useSaveQuote() {
  return useMutation({
    mutationFn: async (quoteData: any) => {
      return fetchJson<{ success: boolean; data: QuoteDocument }>('/api/quotes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(quoteData),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUOTES_QUERY_KEY });
      queryClient.invalidateQueries({ queryKey: ['drafts'] });
    },
  });
}

/** 견적서 상태/내용 수정 */
export function useUpdateQuote() {
  return useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: Partial<QuoteDocument> }) => {
      return fetchJson<{ success: boolean; data: QuoteDocument }>(`/api/quotes/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUOTES_QUERY_KEY });
    },
  });
}

/** 견적서 삭제 (낙관적 삭제 적용: 즉시 목록에서 제거) */
export function useDeleteQuote() {
  return useMutation({
    mutationFn: async (id: string) => {
      return fetchJson<{ success: boolean }>(`/api/quotes/${id}`, {
        method: 'DELETE',
      });
    },
    onMutate: async (id: string) => {
      await queryClient.cancelQueries({ queryKey: QUOTES_QUERY_KEY });
      const previousQuotes = queryClient.getQueryData<QuoteDocument[]>(QUOTES_QUERY_KEY);

      if (previousQuotes) {
        queryClient.setQueriesData<QuoteDocument[]>(
          { queryKey: QUOTES_QUERY_KEY },
          (old) => old?.filter((q) => q.id !== id)
        );
      }
      return { previousQuotes };
    },
    onError: (_err, _id, context) => {
      if (context?.previousQuotes) {
        queryClient.setQueryData(QUOTES_QUERY_KEY, context.previousQuotes);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: QUOTES_QUERY_KEY });
    },
  });
}

// ===========================================================================
// 3. 견적 초안 (Drafts) 쿼리 및 뮤테이션
// ===========================================================================

export const DRAFTS_QUERY_KEY = ['drafts'] as const;

/** 상태별 초안 목록 조회 훅 */
export function useDrafts(status: DraftStatus | 'ALL' = 'ACTIVE') {
  return useQuery({
    queryKey: [...DRAFTS_QUERY_KEY, status],
    queryFn: async () => {
      const res = await fetchValidated(DraftListResponse, `/api/drafts?status=${status}`);
      return res.data;
    },
  });
}

/** 초안 삭제 뮤테이션 */
export function useDeleteDraft() {
  return useMutation({
    mutationFn: async (id: string) => {
      return fetchJson<{ success: boolean }>(`/api/drafts/${id}`, {
        method: 'DELETE',
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: DRAFTS_QUERY_KEY });
    },
  });
}

/** 초안 리비전 복원 뮤테이션 */
export function useRestoreDraft() {
  return useMutation({
    mutationFn: async ({ id, revision }: { id: string; revision: number }) => {
      return fetchJson<{ success: boolean; data: any }>(`/api/drafts/${id}/restore`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ revision }),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: DRAFTS_QUERY_KEY });
    },
  });
}

// ===========================================================================
// 4. AI 파싱 정확도 (Parse Logs) 쿼리
// ===========================================================================

export const PARSE_ACCURACY_QUERY_KEY = ['parse-logs'] as const;

/**
 * 기간별 AI 파싱 수정률·정확도 집계 조회 훅.
 * 사람이 확정을 마친 파싱 건만 지표에 잡힙니다.
 */
export function useParseAccuracyStats(days: number = 30) {
  return useQuery({
    queryKey: [...PARSE_ACCURACY_QUERY_KEY, 'stats', days],
    queryFn: async () => {
      const res = await fetchValidated(
        ParseAccuracyStatsResponse,
        `/api/parse-logs/stats?days=${days}`
      );
      return res.data;
    },
  });
}

/** 최근 파싱 이력 조회 훅 (폴백·지연시간 점검용) */
export function useParseLogs(limit: number = 20) {
  return useQuery({
    queryKey: [...PARSE_ACCURACY_QUERY_KEY, 'list', limit],
    queryFn: async () => {
      const res = await fetchValidated(ParseLogListResponse, `/api/parse-logs?limit=${limit}`);
      return res.data;
    },
  });
}
