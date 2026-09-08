/**
 * 개발 서버 실행 스크립트.
 *
 * server.ts(Express API + Vite 미들웨어)를 tsx watch 로 띄우고,
 * 서버가 실제로 응답하기 시작하면 브라우저를 "한 번만" 엽니다.
 *
 * tsx watch 는 파일 변경 시 server.ts 프로세스를 재시작하는데, 브라우저 열기를
 * server.ts 안에 두면 재시작마다 새 탭이 열립니다. 그래서 재시작의 영향을 받지 않는
 * 이 바깥 프로세스에서 처리합니다.
 *
 * 중복 실행 방지:
 *   개발 서버를 여러 개 띄우면 :3000 을 두고 서로 경쟁하다 계속 죽고 살아나며,
 *   브라우저가 몇 초마다 새로고침되는 현상이 생깁니다.
 *   그래서 시작 전에 포트를 검사하고, 이미 사용 중이면 새로 띄우지 않고 중단합니다.
 */
import { spawn } from 'node:child_process';
import net from 'node:net';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const PORT = Number(process.env.PORT || 3000);
const SERVER_URL = `http://localhost:${PORT}`;
const shouldOpen = !process.argv.includes('--no-open');
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

/** 포트가 비어 있는지 확인 */
function isPortFree(port) {
  return new Promise((resolve) => {
    const probe = net.createServer();
    probe.once('error', (err) => resolve(err.code !== 'EADDRINUSE'));
    probe.once('listening', () => probe.close(() => resolve(true)));
    probe.listen(port, '0.0.0.0');
  });
}

if (!(await isPortFree(PORT))) {
  console.error(`\n[중단] 포트 ${PORT} 가 이미 사용 중입니다.`);
  console.error(`개발 서버가 이미 실행 중일 가능성이 높습니다. 브라우저에서 ${SERVER_URL} 로 접속하세요.`);
  console.error('');
  console.error('중복으로 띄우면 두 서버가 포트를 두고 경쟁하면서');
  console.error('브라우저가 몇 초마다 새로고침되는 현상이 생깁니다.');
  console.error('');
  console.error('기존 서버는 그 터미널에서 Ctrl+C 로 종료하세요. 터미널을 찾을 수 없다면:');
  console.error(
    process.platform === 'win32'
      ? `  powershell "Get-NetTCPConnection -State Listen -LocalPort ${PORT} | ForEach-Object { taskkill /PID $_.OwningProcess /T /F }"\n`
      : `  lsof -ti:${PORT} | xargs kill\n`
  );
  process.exit(1);
}

// shell 을 거치지 않고 tsx CLI 를 직접 실행합니다.
// shell: true 로 띄우면 Ctrl+C 시 셸만 죽고 tsx/node 손자 프로세스가 좀비로 남습니다.
const tsxCli = path.join(root, 'node_modules', 'tsx', 'dist', 'cli.mjs');
const child = spawn(
  process.execPath,
  [
    tsxCli,
    'watch',
    '--ignore', '**/*.timestamp-*.mjs',
    '--ignore', 'data/**',
    '--ignore', 'dist/**',
    '--ignore', 'graphify-out/**',
    'server.ts',
  ],
  { stdio: 'inherit', cwd: root }
);

let shuttingDown = false;
/** tsx watch 는 server.ts 를 손자 프로세스로 띄우므로 프로세스 트리 전체를 종료합니다. */
function shutdown(signal) {
  if (shuttingDown) return;
  shuttingDown = true;
  if (child.pid && child.exitCode === null) {
    if (process.platform === 'win32') {
      spawn('taskkill', ['/PID', String(child.pid), '/T', '/F'], { stdio: 'ignore' });
    } else {
      child.kill(signal);
    }
  }
  setTimeout(() => process.exit(0), 300);
}

child.on('exit', (code) => {
  if (!shuttingDown) process.exit(code ?? 0);
});
for (const sig of ['SIGINT', 'SIGTERM', 'SIGHUP']) {
  process.on(sig, () => shutdown(sig));
}

function openBrowser(url) {
  const cmd =
    process.platform === 'win32' ? `start "" "${url}"`
    : process.platform === 'darwin' ? `open "${url}"`
    : `xdg-open "${url}"`;
  spawn(cmd, { shell: true, stdio: 'ignore', detached: true }).unref();
}

if (shouldOpen) {
  // 서버가 응답할 때까지 기다린 뒤 한 번만 연다 (최대 30초)
  const deadline = Date.now() + 30_000;
  const poll = async () => {
    if (shuttingDown) return;
    try {
      const res = await fetch(`${SERVER_URL}/api/health`);
      if (res.ok) {
        console.log(`\n브라우저를 엽니다: ${SERVER_URL}\n`);
        openBrowser(SERVER_URL);
        return;
      }
    } catch {
      /* 아직 기동 중 */
    }
    if (Date.now() < deadline) setTimeout(poll, 400);
    else console.log(`\n서버 응답 대기 시간을 초과했습니다. 직접 접속하세요: ${SERVER_URL}\n`);
  };
  setTimeout(poll, 800);
}
