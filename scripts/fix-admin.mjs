/**
 * 관리자 계정 진단 및 비밀번호 재설정 스크립트 (Prisma 사용)
 *
 * 실행: node scripts/fix-admin.mjs
 */
import crypto from 'crypto';
import { readFileSync } from 'fs';

// ── .env 로드 ─────────────────────────────────────────────────────────────────
const envText = readFileSync(new URL('../.env', import.meta.url), 'utf8');
for (const line of envText.split('\n')) {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith('#')) continue;
  const eq = trimmed.indexOf('=');
  if (eq === -1) continue;
  const key = trimmed.slice(0, eq).trim();
  let val = trimmed.slice(eq + 1).trim();
  if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
    val = val.slice(1, -1);
  }
  process.env[key] = val;
}

// ── scrypt 해시 함수 ───────────────────────────────────────────────────────────
function hashPassword(plain) {
  const salt = crypto.randomBytes(16);
  const derived = crypto.scryptSync(plain.normalize('NFKC'), salt, 64);
  return `scrypt$${salt.toString('hex')}$${derived.toString('hex')}`;
}

function verifyPassword(plain, stored) {
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

// ── Prisma Client 로드 ────────────────────────────────────────────────────────
const { PrismaClient } = await import('@prisma/client');
const targetEmail = (process.argv[2] || process.env.ADMIN_EMAIL || '').trim().toLowerCase();
const newPassword = process.argv[3] || process.env.ADMIN_PASSWORD || '';

if (!targetEmail || !newPassword) {
  console.log('사용법: node scripts/fix-admin.mjs <관리자이메일> <새비밀번호>');
  console.log('예시  : node scripts/fix-admin.mjs admin@queen.com MySecurePass1234!');
  process.exit(1);
}

const prisma = new PrismaClient();

console.log('🔌 DB 연결 중...\n');

// ── 현재 관리자 계정 조회 ────────────────────────────────────────────────────
const row = await prisma.user.findUnique({
  where: { email: targetEmail },
});

if (!row) {
  console.log(`❌ ${targetEmail} 계정이 존재하지 않습니다.`);
  console.log('→ 새 관리자 계정을 생성합니다...\n');

  const newHash = hashPassword(newPassword);
  await prisma.user.create({
    data: {
      email: targetEmail,
      name: '관리자',
      role: 'ADMIN',
      passwordHash: newHash,
      status: 'ACTIVE',
      mustChangePassword: false,
    },
  });
  console.log('✅ 관리자 계정 생성 완료!');
  console.log(`   이메일: ${targetEmail}`);
} else {
  console.log('📋 현재 계정 상태:');
  console.log(`   ID: ${row.id}`);
  console.log(`   이메일: ${row.email}`);
  console.log(`   이름: ${row.name}`);
  console.log(`   권한: ${row.role}`);
  console.log(`   상태: ${row.status}`);
  console.log(`   비밀번호 변경 필요: ${row.mustChangePassword}`);
  console.log(`   password_hash 형식: ${row.passwordHash?.startsWith('scrypt$') ? '✅ scrypt 형식 정상' : '❌ 형식 이상 → ' + String(row.passwordHash).substring(0, 30)}`);

  console.log('\n→ 비밀번호를 재설정하고 계정 상태를 정상화합니다...');
  const newHash = hashPassword(newPassword);
  await prisma.user.update({
    where: { email: targetEmail },
    data: {
      passwordHash: newHash,
      status: 'ACTIVE',
      mustChangePassword: false,
    },
  });
  console.log('✅ 비밀번호 재설정 완료!');
  console.log(`   이메일: ${targetEmail}`);
}

await prisma.$disconnect();
console.log('\n완료! 설정한 이메일과 비밀번호로 로그인해 보세요.');
