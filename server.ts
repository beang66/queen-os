/**
 * 퀸 주방가구 견적/원가 자동화 시스템 백엔드 서버 진입점
 *
 * 역할:
 * - Express 앱 초기화 및 전역 미들웨어 바인딩
 * - 도메인별 API 라우터 마운트 (pricing, quotes, drafts, gemini)
 * - 개발 환경 Vite 미들웨어 통합 (HMR 웹소켓 단일 포트 서빙)
 * - 프로덕션 SPA 정적 파일 서빙
 */
// 이 import 는 순서가 곧 기능이다. 아래 라우터들이 Prisma 클라이언트를 만들기 전에
// .env 가 로드되어야 하므로 반드시 첫 줄에 둔다 (server/env.ts 주석 참고).
import './server/env.js';

import express from 'express';
import http from 'http';
import path from 'path';
import multer from 'multer';
import { createServer as createViteServer } from 'vite';

import pricingRouter from './routes/pricing.js';
import quotesRouter, { handleExportQuoteExcel } from './routes/quotes.js';
import draftsRouter from './routes/drafts.js';
import parseLogsRouter from './routes/parseLogs.js';
import authRouter from './routes/auth.js';
import usersRouter from './routes/users.js';
import {
  SESSION_COOKIE,
  denyWrites,
  hashSessionToken,
  readCookie,
  requireAuth,
  requireRole,
} from './server/auth.js';
import { parseCustomerOrder, parseUnstructuredDocument } from './server/geminiService.js';
import { db } from './server/db.js';

const app = express();
const PORT = 3000;

// Render 등 리버스 프록시 환경 지원
app.set('trust proxy', 1);

// 파일 업로드(도면/문서)용 Multer 메모리 스토리지
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 25 * 1024 * 1024 }, // 25MB
});

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// ----------------------------------------------------
// 1. HEALTH & METADATA
// ----------------------------------------------------
app.get('/api/health', (_req, res) => {
  res.json({
    status: 'ok',
    system: '퀸 주방가구 견적 및 원가 자동화 시스템 (Queen Kitchen Furniture Automation)',
    version: '1.0.0',
    timestamp: new Date().toISOString(),
  });
});

// ----------------------------------------------------
// 2. 세션 인식 (모든 /api 요청)
//
// 쿠키의 세션 토큰으로 사용자를 찾아 req.user 에 실어둔다. 여기서는 막지 않고,
// 실제 차단은 아래 라우터별 requireAuth/requireRole 이 담당한다.
// 세션 쿠키가 없는 경우 배포 환경 편의를 위해 기본 관리자로 자동 로그인 폴백합니다.
// ----------------------------------------------------
app.use('/api', async (req, _res, next) => {
  try {
    const token = readCookie(req, SESSION_COOKIE);
    if (token) {
      req.user = (await db.getUserBySessionToken(hashSessionToken(token))) ?? undefined;
    }
    // 자동 로그인 지원: 유효한 세션이 없고 수동 로그아웃 상태가 아니며 로그아웃 API가 아니면 기본 관리자로 자동 인식
    if (!req.user && req.path !== '/auth/logout' && req.headers['x-skip-auto-login'] !== 'true') {
      const defaultAdmin = await db.getOrCreateDefaultAdmin();
      if (defaultAdmin) {
        req.user = defaultAdmin;
      }
    }
  } catch (err: any) {
    // 세션 조회 실패로 API 전체를 막지는 않는다. 비로그인으로 취급되어 401 이 난다.
    console.error('세션 확인 실패:', err.message);
  }
  next();
});

app.use('/api/auth', authRouter);

// ----------------------------------------------------
// 3. DOMAIN ROUTERS (로그인 필수)
//
// 화면에서 메뉴를 감추는 것만으로는 권한이 되지 않는다. API 가 열려 있으면
// 주소를 직접 부르면 그만이므로, 차단은 여기서 한다.
// ----------------------------------------------------
app.use('/api/users', requireAuth, usersRouter); // 라우터 내부에서 다시 ADMIN 검사

// 단가표: 조회는 로그인한 모두, 수정은 관리자만 (원가 정보의 원본이므로)
app.use('/api/pricing', requireAuth, (req, res, next) => {
  if (req.method === 'GET') return next();
  return requireRole('ADMIN')(req, res, next);
}, pricingRouter);

app.use('/api/quotes', requireAuth, denyWrites, quotesRouter);
app.use('/api/quote', requireAuth, denyWrites, quotesRouter); // /api/quote/calculate 하위 호환
app.use('/api/drafts', requireAuth, denyWrites, draftsRouter);
app.use('/api/parse-logs', requireAuth, parseLogsRouter);

// 기존 엑셀 다운로드 엔드포인트 호환
app.post('/api/export/quote-excel', requireAuth, handleExportQuoteExcel);

// ----------------------------------------------------
// 3. GEMINI MULTIMODAL EXTRACTION ENDPOINTS
// ----------------------------------------------------
app.post('/api/gemini/parse-doc', requireAuth, denyWrites, upload.single('file'), async (req, res) => {
  try {
    const promptText = req.body.prompt || '';
    let base64File: string | undefined;
    let mimeType: string | undefined;

    if (req.file) {
      base64File = req.file.buffer.toString('base64');
      mimeType = req.file.mimetype;
    } else if (req.body.base64File && req.body.mimeType) {
      base64File = req.body.base64File;
      mimeType = req.body.mimeType;
    }

    const { data: extraction, telemetry } = await parseUnstructuredDocument(
      promptText,
      base64File,
      mimeType
    );

    // 정확도 추적 로그. 문서 파싱은 품목 목록이라 필드 대조 대상이 아니므로
    // 엔진·폴백 여부·추출 품목 수만 남깁니다.
    const parseLogId = await db.createParseLog({
      kind: 'DOCUMENT',
      telemetry,
      parsedSnapshot: extraction,
      itemCount: extraction.extractedItems?.length ?? 0,
    });

    res.json({ success: true, data: extraction, parseLogId });
  } catch (err: any) {
    console.error('Document parsing endpoint error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

app.post('/api/gemini/parse-order', requireAuth, denyWrites, upload.single('image'), async (req, res) => {
  try {
    const promptText = req.body.prompt || '';
    let base64Image: string | undefined;
    let mimeType: string | undefined;

    if (req.file) {
      base64Image = req.file.buffer.toString('base64');
      mimeType = req.file.mimetype;
    } else if (req.body.base64Image && req.body.mimeType) {
      base64Image = req.body.base64Image;
      mimeType = req.body.mimeType;
    }

    const { data: orderEntity, telemetry } = await parseCustomerOrder(
      promptText,
      base64Image,
      mimeType
    );

    // 파싱 시점 스냅샷을 남겨두고, 사람이 검수·발행 단계에서 확정한 값을
    // /api/parse-logs/:id/confirm 으로 되돌려 받아 수정률을 계산합니다.
    const parseLogId = await db.createParseLog({
      kind: 'ORDER',
      telemetry,
      parsedSnapshot: orderEntity,
      draftId: typeof req.body.draftId === 'string' ? req.body.draftId : undefined,
    });

    res.json({ success: true, data: orderEntity, parseLogId });
  } catch (err: any) {
    console.error('Order parsing endpoint error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// ----------------------------------------------------
// 4. VITE MIDDLEWARE / STATIC ASSETS
// ----------------------------------------------------
async function startServer() {
  // Express 를 감싼 HTTP 서버를 직접 만든다. Vite HMR 웹소켓을 이 서버에 얹기 위함.
  const httpServer = http.createServer(app);

  if (process.env.NODE_ENV !== 'production') {
    // vite.config.ts 의 /api 프록시는 `vite` 단독 실행(:5173) 전용이다.
    // 미들웨어 모드에서는 이 서버 자신을 가리키는 자기참조 프록시가 되므로 끈다.
    process.env.QUEEN_MIDDLEWARE_MODE = 'true';

    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        // HMR 웹소켓을 별도 포트(:24678)가 아니라 이 HTTP 서버(:3000)에 얹는다.
        hmr: { server: httpServer },
      },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    // SPA fallback: Express 5 removed bare '*' routes, so use a terminal middleware.
    app.use((_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  httpServer.on('error', (err: NodeJS.ErrnoException) => {
    if (err.code === 'EADDRINUSE') {
      console.error(`\n[오류] 포트 ${PORT} 가 이미 사용 중입니다. 개발 서버가 이미 실행 중인지 확인하세요.`);
      console.error(`이 프로세스를 종료합니다. 브라우저에서 http://localhost:${PORT} 로 접속하세요.\n`);
      process.exit(1);
    }
    throw err;
  });

  httpServer.listen(PORT, '0.0.0.0', () => {
    console.log(`퀸 주방가구 견적/원가 자동화 서버 구동 완료: http://0.0.0.0:${PORT}`);
  });
}

startServer();
