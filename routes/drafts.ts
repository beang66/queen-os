/**
 * 견적 초안 및 자동 저장 라우터 (Drafts API)
 * 
 * 엔드포인트:
 * - POST   /api/drafts             : 신규 초안 생성
 * - GET    /api/drafts             : 상태별 초안 목록 조회
 * - GET    /api/drafts/:id         : 초안 상세 조회 및 단가표 변동 검사
 * - PUT    /api/drafts/:id         : 초안 자동/수동 임시 저장 (낙관적 락 충돌 방어)
 * - POST   /api/drafts/:id/restore : 과거 리비전 상태로 복원
 * - DELETE /api/drafts/:id         : 초안 삭제
 */
import { Router } from 'express';
import { db } from '../server/db.js';
import { parseBody, parseQuery } from '../server/validate.js';
import {
  CreateDraftSchema,
  DraftListQuerySchema,
  RestoreDraftSchema,
  SaveDraftSchema,
} from '../src/schemas.js';

const router = Router();

// 신규 초안 생성
router.post('/', async (req, res) => {
  try {
    const body = parseBody(CreateDraftSchema, req, res);
    if (!body) return;

    const draft = await db.createDraft(body.payload, body.editorId || 'unknown');
    res.json({ success: true, data: draft });
  } catch (err: any) {
    console.error('Create draft error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// 초안 목록 조회 (상태 필터)
router.get('/', async (req, res) => {
  try {
    const query = parseQuery(DraftListQuerySchema, req, res);
    if (!query) return;

    res.json({ success: true, data: await db.getDrafts(query.status) });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 초안 단건 상세 조회 (단가표 변동 지문 메타데이터 포함)
router.get('/:id', async (req, res) => {
  try {
    const draft = await db.getDraftById(req.params.id);
    if (!draft) {
      return res.status(404).json({ success: false, error: '해당 초안을 찾을 수 없습니다.' });
    }
    const currentPricingFingerprint = await db.getPricingFingerprint();
    res.json({
      success: true,
      data: draft,
      // 초안 저장 당시의 단가표와 현재 단가표가 다른지 함께 알려준다.
      meta: {
        currentPricingFingerprint,
        pricingChanged: !!draft.pricingFingerprint && draft.pricingFingerprint !== currentPricingFingerprint,
      },
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 초안 저장 (낙관적 동시성 제어)
router.put('/:id', async (req, res) => {
  try {
    const body = parseBody(SaveDraftSchema, req, res);
    if (!body) return;

    const result = await db.saveDraft(req.params.id, {
      revision: body.revision,
      payload: body.payload,
      label: body.label,
      editorId: body.editorId || 'unknown',
    });

    if (result.status === 'OK') {
      return res.json({ success: true, data: result.draft });
    }
    if (result.status === 'NOT_FOUND') {
      return res.status(404).json({ success: false, error: '해당 초안을 찾을 수 없습니다.' });
    }
    // 다른 창에서 먼저 저장한 경우 — 덮어쓰지 않고 서버 최신본을 함께 돌려준다.
    return res.status(409).json({
      success: false,
      error: '다른 창에서 이 초안을 먼저 수정했습니다.',
      conflict: true,
      data: result.current,
    });
  } catch (err: any) {
    console.error('Save draft error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// 특정 리비전 복원
router.post('/:id/restore', async (req, res) => {
  try {
    const body = parseBody(RestoreDraftSchema, req, res);
    if (!body) return;

    const restored = await db.restoreDraftRevision(req.params.id, body.revision, body.editorId || 'unknown');
    if (!restored) {
      return res.status(404).json({ success: false, error: '해당 초안 또는 저장 시점을 찾을 수 없습니다.' });
    }
    res.json({ success: true, data: restored });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 초안 삭제
router.delete('/:id', async (req, res) => {
  try {
    res.json({ success: await db.deleteDraft(req.params.id) });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

export default router;
