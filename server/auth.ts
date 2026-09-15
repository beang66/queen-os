/**
 * 인증·인가 코어.
 *
 * 설계 요지:
 * - 비밀번호는 node:crypto 의 scrypt 로 해싱합니다 (추가 의존성 없음).
 *   비교는 timingSafeEqual 로만 하고, 원문은 어디에도 남기지 않습니다.
 * - 세션 토큰은 32바이트 난수입니다. 쿠키에는 원문이, DB 에는 SHA-256 해시만
 *   들어갑니다. DB 가 통째로 유출돼도 그 값으로 로그인할 수 없습니다.
 * - 쿠키는 httpOnly + SameSite=Lax 라 스크립트로 읽을 수 없고, 다른 사이트에서
 *   보낸 POST 에는 실려가지 않습니다 (CSRF 기본 방어).
 */
import crypto from 'crypto';
import type { NextFunction, Request, Response } from 'express';
import { AuthUser, UserRole } from '../src/types.js';

/** 세션 쿠키 이름 */
export const SESSION_COOKIE = 'queen_session';

/** 세션 유효 기간 (일) */
export const SESSION_DAYS = 14;

const SCRYPT_KEYLEN = 64;

// ---------------------------------------------------------------------------
// 비밀번호
// ---------------------------------------------------------------------------

/** `scrypt$<salt-hex>$<hash-hex>` 형식으로 저장합니다. */
export function hashPassword(plain: string): string {
  const salt = crypto.randomBytes(16);
  const derived = crypto.scryptSync(plain.normalize('NFKC'), salt, SCRYPT_KEYLEN);
  return `scrypt$${salt.toString('hex')}$${derived.toString('hex')}`;
}

/** 저장된 해시와 대조. 형식이 깨졌거나 길이가 달라도 예외 없이 false 를 돌려줍니다. */
export function verifyPassword(plain: string, stored: string): boolean {
  try {
    const [scheme, saltHex, hashHex] = stored.split('$');
    if (scheme !== 'scrypt' || !saltHex || !hashHex) return false;

    const expected = Buffer.from(hashHex, 'hex');
    const actual = crypto.scryptSync(plain.normalize('NFKC'), Buffer.from(saltHex, 'hex'), expected.length);
    return crypto.timingSafeEqual(expected, actual);
  } catch {
    return false;
  }
}

/**
 * 관리자가 계정을 만들 때 나눠줄 초기 비밀번호.
 * 사람이 받아적어 옮기는 값이라, 헷갈리는 글자(0/O/1/l/I)는 뺐습니다.
 */
export function generateInitialPassword(length = 12): string {
  const alphabet = 'abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const bytes = crypto.randomBytes(length);
  let out = '';
  for (let i = 0; i < length; i += 1) {
    out += alphabet[bytes[i] % alphabet.length];
  }
  return out;
}

/** 비밀번호 규칙. 사내 시스템이라 과하지 않게, 그러나 8자 미만은 막습니다. */
export function validatePasswordStrength(plain: string): string | null {
  if (plain.length < 8) return '비밀번호는 8자 이상이어야 합니다.';
  if (plain.length > 200) return '비밀번호가 너무 깁니다.';
  if (!/[A-Za-z]/.test(plain) || !/[0-9]/.test(plain)) {
    return '비밀번호에는 영문과 숫자가 모두 들어가야 합니다.';
  }
  return null;
}

// ---------------------------------------------------------------------------
// 세션 토큰
// ---------------------------------------------------------------------------

export function createSessionToken(): string {
  return crypto.randomBytes(32).toString('base64url');
}

export function hashSessionToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

// ---------------------------------------------------------------------------
// 쿠키 (의존성 없이 직접 다룬다 — 쿠키는 이거 하나뿐입니다)
// ---------------------------------------------------------------------------

export function readCookie(req: Request, name: string): string | undefined {
  const header = req.headers.cookie;
  if (!header) return undefined;

  for (const part of header.split(';')) {
    const eq = part.indexOf('=');
    if (eq === -1) continue;
    if (part.slice(0, eq).trim() === name) {
      return decodeURIComponent(part.slice(eq + 1).trim());
    }
  }
  return undefined;
}

// expiresAt 은 DB 세션 레코드에만 기록됩니다.
// 쿠키에 expires/maxAge 를 지정하지 않으면 브라우저는 세션 쿠키로 취급하여
// 브라우저 창을 완전히 닫을 때 쿠키를 자동으로 삭제합니다 (자동 로그아웃).
export function setSessionCookie(res: Response, token: string, _expiresAt?: Date): void {
  res.cookie(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
  });
}

export function clearSessionCookie(res: Response): void {
  res.clearCookie(SESSION_COOKIE, { path: '/' });
}

// ---------------------------------------------------------------------------
// 권한
// ---------------------------------------------------------------------------

export const ROLE_LABEL: Record<UserRole, string> = {
  ADMIN: '관리자',
  ESTIMATOR: '견적담당',
  VIEWER: '조회전용',
};

/** 요청에 붙는 로그인 사용자. requireAuth 를 통과한 뒤에만 채워집니다. */
declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: AuthUser;
    }
  }
}

/** 로그인 필수. 통과하면 req.user 가 채워집니다. */
export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  if (!req.user) {
    res.status(401).json({ success: false, error: '로그인이 필요합니다.' });
    return;
  }
  next();
}

/** 지정한 등급만 통과. requireAuth 뒤에 붙여 씁니다. */
export function requireRole(...roles: UserRole[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({ success: false, error: '로그인이 필요합니다.' });
      return;
    }
    if (!roles.includes(req.user.role)) {
      res.status(403).json({
        success: false,
        error: `이 기능은 ${roles.map((r) => ROLE_LABEL[r]).join('·')} 등급만 사용할 수 있습니다.`,
      });
      return;
    }
    next();
  };
}

/**
 * 쓰기 요청 차단 (조회전용 등급).
 *
 * 등급별 화면 숨김만으로는 부족합니다. 화면을 숨겨도 API 는 그대로 열려 있으므로,
 * 실제 차단은 여기서 합니다.
 */
export function denyWrites(req: Request, res: Response, next: NextFunction): void {
  if (req.method === 'GET' || req.method === 'HEAD' || req.method === 'OPTIONS') {
    next();
    return;
  }
  if (req.user?.role === 'VIEWER') {
    res.status(403).json({
      success: false,
      error: '조회전용 등급은 자료를 수정할 수 없습니다.',
    });
    return;
  }
  next();
}
