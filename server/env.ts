/**
 * 환경 변수 로딩 — 반드시 다른 어떤 모듈보다 먼저 평가되어야 하는 부수효과 모듈.
 *
 * 왜 별도 파일인가:
 *   ESM 의 import 문은 그 파일의 본문(예: `dotenv.config()`)보다 항상 먼저 평가됩니다.
 *   server.ts 아래쪽에서 dotenv.config() 를 호출해봐야, 그 위의
 *   `import ... from './routes/pricing.js'` → `server/db.ts` → `new PrismaClient()`
 *   가 이미 실행된 뒤입니다. 즉 Prisma 는 .env 가 로드되기 전에 만들어집니다.
 *
 *   지금까지 이게 동작한 건 @prisma/client 가 스스로 .env 를 찾아 읽어주는
 *   내부 동작 덕분이었습니다. 이 동작은 문서화된 계약이 아니고 Prisma 7 에서
 *   제거될 예정이라, 그때 또는 번들링·배포 환경에서 사라지면
 *   "Environment variable not found: DATABASE_URL" 이 요청 처리 중에 터집니다.
 *
 *   그래서 env 로딩을 이 파일 하나로 모으고, DB 를 건드리는 모든 진입점
 *   (server.ts, server/db.ts)이 첫 줄에서 이 파일을 import 합니다.
 *
 * 또 하나: 경로를 process.cwd() 가 아니라 이 파일 위치 기준으로 잡습니다.
 * 다른 디렉터리에서 서버를 띄워도 같은 .env 를 읽게 하기 위함입니다.
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

/** 이 파일은 server/ 안에 있으므로, 한 단계 위가 프로젝트 루트다. */
const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const envPath = path.join(projectRoot, '.env');

if (fs.existsSync(envPath)) {
  // 이미 설정된 실제 환경 변수(배포 환경의 주입값)를 덮어쓰지 않는다.
  dotenv.config({ path: envPath });
}

/** DB 없이는 어떤 API 도 의미가 없으므로, 없으면 기동 자체를 멈춘다. */
export function assertDatabaseEnv(): void {
  if (process.env.DATABASE_URL) return;

  const hint = fs.existsSync(envPath)
    ? `${envPath} 에 DATABASE_URL 항목이 없습니다.`
    : `${envPath} 파일이 없습니다. .env.example 을 복사해 만드세요.`;

  throw new Error(
    [
      '',
      '[기동 중단] 데이터베이스 접속 정보(DATABASE_URL)를 찾을 수 없습니다.',
      hint,
      '',
      '이 값이 없으면 견적 초안 저장·단가 조회 등 DB 를 쓰는 모든 요청이 실패합니다.',
      '.env 를 채운 뒤 서버를 다시 시작하세요.',
      '',
    ].join('\n')
  );
}

export { projectRoot, envPath };
