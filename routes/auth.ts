/**
 * 로그인·세션 라우터 (Auth API)
 *
 * 엔드포인트:
 * - POST /api/auth/login    : 이메일·비밀번호 로그인 (세션 쿠키 발급)
 * - POST /api/auth/logout   : 로그아웃 (세션 폐기)
 * - GET  /api/auth/me       : 현재 로그인 사용자
 * - POST /api/auth/password : 본인 비밀번호 변경
 *
 * 이 라우터만 로그인 없이 접근할 수 있습니다 (아래 me/password 는 예외적으로 확인).
 */
import { Router } from 'express';
import { db, describeDbError } from '../server/db.js';
import { parseBody } from '../server/validate.js';
import { ChangePasswordSchema, LoginSchema } from '../src/schemas.js';
import {
  SESSION_DAYS,
  clearSessionCookie,
  createSessionToken,
  hashSessionToken,
  readCookie,
  requireAuth,
  setSessionCookie,
  validatePasswordStrength,
  SESSION_COOKIE,
} from '../server/auth.js';

const router = Router();

/** 로그인 시도 실패를 한 문장으로 통일한다 — 어느 쪽이 틀렸는지 알려주지 않는다. */
const INVALID_MESSAGE = '이메일 또는 비밀번호가 올바르지 않습니다.';

/** 새 세션을 만들고 쿠키를 굽는다. */
async function issueSession(userId: string, res: any, userAgent?: string) {
  const token = createSessionToken();
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 86_400_000);
  await db.createSession(userId, hashSessionToken(token), expiresAt, userAgent);
  setSessionCookie(res, token, expiresAt);
}

router.post('/login', async (req, res) => {
  try {
    const body = parseBody(LoginSchema, req, res);
    if (!body) return;

    const result = await db.verifyCredentials(body.email, body.password);

    if (result.status === 'DISABLED') {
      return res.status(403).json({
        success: false,
        error: '비활성화된 계정입니다. 관리자에게 문의하세요.',
      });
    }
    if (result.status !== 'OK') {
      return res.status(401).json({ success: false, error: INVALID_MESSAGE });
    }

    await issueSession(result.user.id, res, req.headers['user-agent']);

    res.json({
      success: true,
      data: {
        id: result.user.id,
        email: result.user.email,
        name: result.user.name,
        role: result.user.role,
        mustChangePassword: result.user.mustChangePassword,
      },
    });
  } catch (err: any) {
    console.error('Login error:', err);
    res.status(500).json({ success: false, error: describeDbError(err) });
  }
});

router.post('/logout', async (req, res) => {
  try {
    const token = readCookie(req, SESSION_COOKIE);
    if (token) await db.deleteSession(hashSessionToken(token));
    clearSessionCookie(res);
    res.json({ success: true });
  } catch (err: any) {
    // 로그아웃은 실패해도 쿠키는 지운다 — 사용자를 로그인 상태에 가둬두지 않는다.
    clearSessionCookie(res);
    res.json({ success: true, warning: describeDbError(err) });
  }
});

/** 현재 사용자. 비로그인 상태에서도 200 으로 null 을 돌려줘 화면이 분기할 수 있게 한다. */
router.get('/me', (req, res) => {
  res.json({ success: true, data: req.user ?? null });
});

/**
 * 본인 비밀번호 변경.
 * 변경 시 기존 세션이 모두 끊기므로, 지금 쓰는 창에는 새 세션을 바로 발급합니다.
 */
router.post('/password', requireAuth, async (req, res) => {
  try {
    const body = parseBody(ChangePasswordSchema, req, res);
    if (!body) return;

    const current = await db.getUserById(req.user!.id);
    if (!current) {
      return res.status(404).json({ success: false, error: '계정을 찾을 수 없습니다.' });
    }

    const verified = await db.verifyCredentials(current.email, body.currentPassword);
    if (verified.status !== 'OK') {
      return res.status(400).json({ success: false, error: '현재 비밀번호가 올바르지 않습니다.' });
    }

    const weak = validatePasswordStrength(body.newPassword);
    if (weak) return res.status(400).json({ success: false, error: weak });

    await db.setPassword(req.user!.id, body.newPassword, { mustChange: false });
    await issueSession(req.user!.id, res, req.headers['user-agent']);

    res.json({ success: true, data: { ...req.user!, mustChangePassword: false } });
  } catch (err: any) {
    console.error('Change password error:', err);
    res.status(500).json({ success: false, error: describeDbError(err) });
  }
});

export default router;
