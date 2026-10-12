import React, { useState } from 'react';
import { KeyRound, Loader2, LogIn, ShieldAlert, Sparkles } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';

/**
 * 로그인 화면.
 *
 * 배포 주소 접속 시에는 자동으로 로그인되며, 로그아웃 후 다시 접속하거나
 * 계정을 전환할 때 이 화면을 이용합니다.
 */
export const LoginPage: React.FC = () => {
  const { login, autoLogin } = useAuth();
  const [email, setEmail] = useState('admin@queen.com');
  const [password, setPassword] = useState('Admin1234!');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      await login(email, password);
    } catch (err: any) {
      setError(err.message || '로그인에 실패했습니다.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleQuickLogin = async () => {
    setSubmitting(true);
    setError(null);
    try {
      await autoLogin();
    } catch (err: any) {
      try {
        await login(email, password);
      } catch (loginErr: any) {
        setError(loginErr.message || '자동 로그인에 실패했습니다.');
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#1e293b] flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        {/* 브랜드 */}
        <div className="flex items-center justify-center gap-3 mb-6">
          <img
            src="/queen-os.png"
            alt="Queen OS"
            className="w-10 h-10 rounded object-cover ring-1 ring-white/10"
          />
          <div>
            <h1 className="text-lg font-bold tracking-tight text-white uppercase leading-tight">
              QUEEN KITCHEN
            </h1>
            <p className="text-[11px] font-mono text-gray-400">Automated Costing System</p>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-lg space-y-4">
          <div>
            <h2 className="text-sm font-bold text-gray-900">로그인</h2>
            <p className="mt-0.5 text-[11px] text-gray-500">
              배포 시스템 데모 및 테스트용 자동 로그인을 지원합니다.
            </p>
          </div>

          {/* 원클릭 관리자 자동 로그인 버튼 */}
          <button
            type="button"
            onClick={handleQuickLogin}
            disabled={submitting}
            className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 disabled:opacity-50 text-white text-sm font-semibold px-4 py-2.5 rounded-lg shadow-sm transition-all cursor-pointer"
          >
            {submitting ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Sparkles className="w-4 h-4 text-emerald-200" />
            )}
            <span>관리자 원클릭 자동 로그인</span>
          </button>

          <div className="relative flex items-center justify-center">
            <div className="border-t border-gray-200 w-full" />
            <span className="bg-white px-2 text-[11px] text-gray-400 shrink-0">또는 직접 입력</span>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-3">
              <label className="block">
                <span className="text-[11px] font-semibold text-gray-600">이메일</span>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  autoComplete="username"
                  required
                  className="mt-1 w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-hidden focus:ring-2 focus:ring-blue-500/40 focus:border-blue-400"
                  placeholder="admin@queen.com"
                />
              </label>

              <label className="block">
                <span className="text-[11px] font-semibold text-gray-600">비밀번호</span>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="current-password"
                  required
                  className="mt-1 w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-hidden focus:ring-2 focus:ring-blue-500/40 focus:border-blue-400"
                  placeholder="••••••••"
                />
              </label>
            </div>

            {error && (
              <div
                role="alert"
                className="flex items-start gap-2 bg-rose-50 border border-rose-200 rounded-lg p-2.5 text-xs text-rose-700"
              >
                <ShieldAlert className="w-4 h-4 shrink-0 mt-px" />
                <span className="whitespace-pre-line">{error}</span>
              </div>
            )}

            <button
              type="submit"
              disabled={submitting}
              className="w-full flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 text-white text-sm font-semibold px-4 py-2.5 rounded-lg transition-colors cursor-pointer"
            >
              {submitting ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <LogIn className="w-4 h-4" />
              )}
              {submitting ? '확인 중...' : '로그인'}
            </button>
          </form>

          <p className="flex items-start gap-1.5 pt-1 text-[11px] text-gray-400 border-t border-gray-100">
            <KeyRound className="w-3.5 h-3.5 shrink-0 mt-0.5" />
            기본 관리자 계정: <span className="font-mono text-gray-600">admin@queen.com / Admin1234!</span>
          </p>
        </div>
      </div>
    </div>
  );
};
