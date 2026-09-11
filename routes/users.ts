/**
 * 사용자 관리 라우터 (Users API) — 관리자 전용
 *
 * 엔드포인트:
 * - GET    /api/users                     : 계정 목록
 * - POST   /api/users                     : 계정 생성 (초기 비밀번호를 1회만 응답에 담아 반환)
 * - PATCH  /api/users/:id                 : 이름·등급·상태 변경
 * - POST   /api/users/:id/reset-password  : 비밀번호 초기화 (새 임시 비밀번호 반환)
 * - DELETE /api/users/:id                 : 계정 삭제
 *
 * 스스로를 잠가버리는 조작(마지막 관리자 강등·비활성·삭제, 본인 비활성)은 막습니다.
 */
import { Router } from 'express';
import { db, describeDbError } from '../server/db.js';
import { parseBody } from '../server/validate.js';
import { CreateUserSchema, UpdateUserSchema } from '../src/schemas.js';
import { generateInitialPassword, requireRole } from '../server/auth.js';

const router = Router();

// 이 라우터 전체가 관리자 전용입니다.
router.use(requireRole('ADMIN'));

router.get('/', async (_req, res) => {
  try {
    const users = await db.getUsers();
    res.json({ success: true, count: users.length, data: users });
  } catch (err: any) {
    res.status(500).json({ success: false, error: describeDbError(err) });
  }
});

router.post('/', async (req, res) => {
  try {
    const body = parseBody(CreateUserSchema, req, res);
    if (!body) return;

    const email = body.email.toLowerCase().trim();
    const existing = await db.getUsers();
    if (existing.some((u) => u.email === email)) {
      return res.status(409).json({ success: false, error: '이미 등록된 이메일입니다.' });
    }

    // 초기 비밀번호는 여기서 한 번만 평문으로 나갑니다. DB 에는 해시만 남습니다.
    const initialPassword = generateInitialPassword();
    const user = await db.createUser({
      email,
      name: body.name,
      role: body.role,
      password: initialPassword,
    });

    res.json({ success: true, data: user, initialPassword });
  } catch (err: any) {
    console.error('Create user error:', err);
    res.status(500).json({ success: false, error: describeDbError(err) });
  }
});

router.patch('/:id', async (req, res) => {
  try {
    const body = parseBody(UpdateUserSchema, req, res);
    if (!body) return;

    const target = await db.getUserById(req.params.id);
    if (!target) {
      return res.status(404).json({ success: false, error: '계정을 찾을 수 없습니다.' });
    }

    const losingAdmin =
      target.role === 'ADMIN' &&
      target.status === 'ACTIVE' &&
      ((body.role !== undefined && body.role !== 'ADMIN') || body.status === 'DISABLED');

    if (losingAdmin && (await db.countActiveAdmins(target.id)) === 0) {
      return res.status(400).json({
        success: false,
        error: '마지막 관리자입니다. 다른 관리자를 먼저 지정한 뒤에 변경하세요.',
      });
    }
    if (body.status === 'DISABLED' && target.id === req.user!.id) {
      return res.status(400).json({ success: false, error: '자기 계정은 비활성화할 수 없습니다.' });
    }

    const updated = await db.updateUser(req.params.id, body);
    if (!updated) {
      return res.status(404).json({ success: false, error: '계정을 찾을 수 없습니다.' });
    }
    res.json({ success: true, data: updated });
  } catch (err: any) {
    console.error('Update user error:', err);
    res.status(500).json({ success: false, error: describeDbError(err) });
  }
});

/** 비밀번호 초기화 — 새 임시 비밀번호를 만들고, 첫 로그인 시 변경을 요구합니다. */
router.post('/:id/reset-password', async (req, res) => {
  try {
    const target = await db.getUserById(req.params.id);
    if (!target) {
      return res.status(404).json({ success: false, error: '계정을 찾을 수 없습니다.' });
    }

    const initialPassword = generateInitialPassword();
    const ok = await db.setPassword(target.id, initialPassword, { mustChange: true });
    if (!ok) {
      return res.status(500).json({ success: false, error: '비밀번호를 초기화하지 못했습니다.' });
    }

    res.json({ success: true, data: { ...target, mustChangePassword: true }, initialPassword });
  } catch (err: any) {
    console.error('Reset password error:', err);
    res.status(500).json({ success: false, error: describeDbError(err) });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    if (req.params.id === req.user!.id) {
      return res.status(400).json({ success: false, error: '자기 계정은 삭제할 수 없습니다.' });
    }

    const target = await db.getUserById(req.params.id);
    if (!target) {
      return res.status(404).json({ success: false, error: '계정을 찾을 수 없습니다.' });
    }
    if (target.role === 'ADMIN' && (await db.countActiveAdmins(target.id)) === 0) {
      return res.status(400).json({
        success: false,
        error: '마지막 관리자입니다. 다른 관리자를 먼저 지정한 뒤에 삭제하세요.',
      });
    }

    res.json({ success: await db.deleteUser(req.params.id) });
  } catch (err: any) {
    console.error('Delete user error:', err);
    res.status(500).json({ success: false, error: describeDbError(err) });
  }
});

export default router;
