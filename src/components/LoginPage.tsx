import React, { useState } from 'react';
import { KeyRound, Loader2, LogIn, ShieldAlert } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';

/**
 * 로그인 화면.
 *
 * 계정은 관리자만 만들 수 있으므로 가입 경로는 없습니다. 대신 계정이 필요한
 * 사람이 무엇을 해야 하는지 화면에서 알려줍니다.
 */
export const LoginPage: React.FC = () => {
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
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

        <form
          onSubmit={handleSubmit}
          className="bg-white rounded-xl border border-gray-200 p-6 shadow-lg space-y-4"
        >
          <div>
            <h2 className="text-sm font-bold text-gray-900">로그인</h2>
            <p className="mt-0.5 text-[11px] text-gray-500">
              회사에서 발급받은 계정으로 접속하세요.
            </p>
          </div>

          <div className="space-y-3">
            <label className="block">
              <span className="text-[11px] font-semibold text-gray-600">이메일</span>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="username"
                autoFocus
                required
                className="mt-1 w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-hidden focus:ring-2 focus:ring-blue-500/40 focus:border-blue-400"
                placeholder="name@queenkitchen.kr"
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
            className="w-full flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 text-white text-sm font-semibold px-4 py-2.5 rounded-lg transition-colors"
          >
            {submitting ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <LogIn className="w-4 h-4" />
            )}
            {submitting ? '확인 중...' : '로그인'}
          </button>

          <p className="flex items-start gap-1.5 pt-1 text-[11px] text-gray-400 border-t border-gray-100">
            <KeyRound className="w-3.5 h-3.5 shrink-0 mt-0.5" />
            계정이 없거나 비밀번호를 잊으셨다면 시스템 관리자에게 요청하세요. 이 시스템은
            관리자가 계정을 만들어 발급합니다.
          </p>
        </form>
      </div>
    </div>
  );
};
