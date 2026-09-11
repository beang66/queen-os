import React, { createContext, useCallback, useContext, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { fetchJson, fetchValidated } from '../lib/api';
import { AuthUserResponse, SessionResponse } from '../schemas';
import { AuthUser, UserRole } from '../types';
import { queryClient } from '../lib/queryClient';

export const SESSION_QUERY_KEY = ['auth', 'session'] as const;

interface AuthContextValue {
  user: AuthUser | null;
  /** 최초 세션 확인이 끝나기 전 (로그인 화면을 깜빡이며 보여주지 않기 위해) */
  loading: boolean;
  login: (email: string, password: string) => Promise<AuthUser>;
  logout: () => Promise<void>;
  changePassword: (currentPassword: string, newPassword: string) => Promise<void>;
  /** 등급 확인 헬퍼 — 화면 분기용. 실제 차단은 서버가 합니다. */
  can: {
    manageUsers: boolean;
    managePricing: boolean;
    editQuotes: boolean;
    seeCost: boolean;
  };
}

const AuthContext = createContext<AuthContextValue | null>(null);

/** 등급 → 화면에서 열어줄 기능. 서버의 requireRole/denyWrites 와 짝을 이룹니다. */
function permissionsFor(role: UserRole | undefined) {
  return {
    manageUsers: role === 'ADMIN',
    managePricing: role === 'ADMIN',
    editQuotes: role === 'ADMIN' || role === 'ESTIMATOR',
    seeCost: role === 'ADMIN' || role === 'ESTIMATOR',
  };
}

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { data, isLoading } = useQuery({
    queryKey: SESSION_QUERY_KEY,
    queryFn: async () => {
      const res = await fetchValidated(SessionResponse, '/api/auth/me');
      return res.data;
    },
    // 세션은 화면 진입마다 확인한다. 만료된 채로 오래 남아 있으면
    // 사용자가 작성 도중 401 을 만나게 된다.
    staleTime: 0,
    retry: false,
  });

  const user = data ?? null;

  const login = useCallback(async (email: string, password: string) => {
    const res = await fetchValidated(AuthUserResponse, '/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    queryClient.setQueryData(SESSION_QUERY_KEY, res.data);
    return res.data;
  }, []);

  const logout = useCallback(async () => {
    try {
      await fetchJson('/api/auth/logout', { method: 'POST' });
    } finally {
      // 서버 응답과 무관하게 화면 상태는 로그아웃으로 만든다.
      queryClient.setQueryData(SESSION_QUERY_KEY, null);
      queryClient.clear();
    }
  }, []);

  const changePassword = useCallback(async (currentPassword: string, newPassword: string) => {
    const res = await fetchValidated(AuthUserResponse, '/api/auth/password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ currentPassword, newPassword }),
    });
    queryClient.setQueryData(SESSION_QUERY_KEY, res.data);
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      loading: isLoading,
      login,
      logout,
      changePassword,
      can: permissionsFor(user?.role),
    }),
    [user, isLoading, login, logout, changePassword]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth 는 AuthProvider 안에서만 쓸 수 있습니다.');
  return ctx;
}
