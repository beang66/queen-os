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
const prisma = new PrismaClient();

console.log('🔌 DB 연결 중...\n');

// ── 현재 관리자 계정 조회 ────────────────────────────────────────────────────
const row = await prisma.user.findUnique({
  where: { email: 'admin@queen.com' },
});

if (!row) {
  console.log('❌ admin@queen.com 계정이 존재하지 않습니다.');
  console.log('→ 새 관리자 계정을 생성합니다...\n');

  const newHash = hashPassword('Admin1234!');
  await prisma.user.create({
    data: {
      email: 'admin@queen.com',
      name: '관리자',
      role: 'ADMIN',
      passwordHash: newHash,
      status: 'ACTIVE',
      mustChangePassword: false,
    },
  });
  console.log('✅ 관리자 계정 생성 완료!');
  console.log('   이메일: admin@queen.com');
  console.log('   비밀번호: Admin1234!');
} else {
  console.log('📋 현재 계정 상태:');
  console.log(`   ID: ${row.id}`);
  console.log(`   이메일: ${row.email}`);
  console.log(`   이름: ${row.name}`);
  console.log(`   권한: ${row.role}`);
  console.log(`   상태: ${row.status}`);
  console.log(`   비밀번호 변경 필요: ${row.mustChangePassword}`);
  console.log(`   password_hash 형식: ${row.passwordHash?.startsWith('scrypt$') ? '✅ scrypt 형식 정상' : '❌ 형식 이상 → ' + String(row.passwordHash).substring(0, 30)}`);

  // 현재 비밀번호로 검증 시도
  const ok = verifyPassword('Admin1234!', row.passwordHash);
  console.log(`   비밀번호 'Admin1234!' 검증: ${ok ? '✅ 일치' : '❌ 불일치'}\n`);

  if (!ok || row.status !== 'ACTIVE' || row.mustChangePassword) {
    console.log('→ 비밀번호를 재설정하고 계정 상태를 정상화합니다...');
    const newHash = hashPassword('Admin1234!');
    await prisma.user.update({
      where: { email: 'admin@queen.com' },
      data: {
        passwordHash: newHash,
        status: 'ACTIVE',
        mustChangePassword: false,
      },
    });
    console.log('✅ 비밀번호 재설정 완료!');
    console.log('   이메일: admin@queen.com');
    console.log('   비밀번호: Admin1234!');
  } else {
    console.log('✅ 계정 상태 이상 없음 — 로그인이 여전히 안 되면 서버 로그를 확인하세요.');
  }
}

await prisma.$disconnect();
console.log('\n완료! 이제 admin@queen.com / Admin1234! 로 로그인해 보세요.');
