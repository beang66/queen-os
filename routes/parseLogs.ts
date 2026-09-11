/**
 * AI 파싱 정확도 추적 라우터 (Parse Logs API)
 *
 * 엔드포인트:
 * - POST /api/parse-logs/:id/confirm : 사람이 확정한 주문 정보를 받아 필드별 수정 내역 기록
 * - GET  /api/parse-logs             : 최근 파싱 이력 (폴백 빈도·지연시간 점검용)
 * - GET  /api/parse-logs/stats       : 기간별 수정률/정확도 집계 (필드별 순위 포함)
 */
import { Router } from 'express';
import { db, describeDbError } from '../server/db.js';
import { parseBody, parseQuery } from '../server/validate.js';
import { ConfirmParseLogSchema, ParseLogListQuerySchema, ParseLogStatsQuerySchema } from '../src/schemas.js';

const router = Router();

// 기간별 집계. '/:id' 보다 먼저 선언해야 'stats' 가 id 로 잡히지 않는다.
router.get('/stats', async (req, res) => {
  try {
    const query = parseQuery(ParseLogStatsQuerySchema, req, res);
    if (!query) return;

    const stats = await db.getParseAccuracyStats(query.days);
    res.json({ success: true, data: stats });
  } catch (err: any) {
    console.error('Parse log stats error:', err);
    res.status(500).json({ success: false, error: describeDbError(err) });
  }
});

router.get('/', async (req, res) => {
  try {
    const query = parseQuery(ParseLogListQuerySchema, req, res);
    if (!query) return;

    const logs = await db.getParseLogs(query.limit, query.kind);
    res.json({ success: true, count: logs.length, data: logs });
  } catch (err: any) {
    res.status(500).json({ success: false, error: describeDbError(err) });
  }
});

/**
 * 확정 값 기록.
 *
 * 같은 로그를 검수 단계와 발행 단계에서 두 번 보낼 수 있고, 마지막 값이 남습니다.
 * 이 호출은 화면 흐름을 막지 않아야 하므로, 로그가 이미 사라진 경우(보존 기간
 * 경과 등)에도 404 대신 무시했다는 응답을 돌려줍니다.
 */
router.post('/:id/confirm', async (req, res) => {
  try {
    const body = parseBody(ConfirmParseLogSchema, req, res);
    if (!body) return;

    const diff = await db.confirmParseLog(
      req.params.id,
      body.orderEntity,
      body.stage,
      body.draftId
    );

    if (!diff) {
      return res.json({ success: true, data: null, skipped: '해당 파싱 로그를 찾을 수 없습니다.' });
    }
    res.json({ success: true, data: diff });
  } catch (err: any) {
    console.error('Parse log confirm error:', err);
    res.status(500).json({ success: false, error: describeDbError(err) });
  }
});

export default router;
