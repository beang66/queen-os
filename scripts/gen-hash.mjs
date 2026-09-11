// auth.ts의 hashPassword 함수와 동일한 로직으로 비밀번호 해시를 생성합니다.
import crypto from 'crypto';

const SCRYPT_KEYLEN = 64;
const plain = process.argv[2] || 'Admin1234!';

const salt = crypto.randomBytes(16);
const derived = crypto.scryptSync(plain.normalize('NFKC'), salt, SCRYPT_KEYLEN);
const hash = `scrypt$${salt.toString('hex')}$${derived.toString('hex')}`;

console.log(hash);
