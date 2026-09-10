import { QueryClient } from '@tanstack/react-query';

/**
 * 전역 TanStack Query 클라이언트 인스턴스.
 *
 * 기본 캐시 정책:
 * - staleTime: 5분 (잦은 탭 전환 시 중복 네트워크 요청 차단)
 * - gcTime: 30분 (사용하지 않는 캐시 30분 유지)
 * - retry: 1회 (네트워크 일시 오류 복구)
 * - refetchOnWindowFocus: false (입력 양식 작성 중 예기치 않은 데이터 덮어쓰기 방지)
 */
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5,
      gcTime: 1000 * 60 * 30,
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});
