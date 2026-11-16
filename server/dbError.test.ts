import { describe, expect, it } from 'vitest';

describe('describeDbError: 외부 API 오류 노출 방지', () => {
  it('알 수 없는 데이터베이스 내부 정보는 일반 메시지로 바꾼다', async () => {
    process.env.DATABASE_URL ||= 'postgresql://test:test@127.0.0.1:1/test';
    const { describeDbError } = await import('./db.js');
    const result = describeDbError(new Error('Invalid invocation: secret-db-host:5432/schema'));
    expect(result).toBe('요청을 처리할 수 없습니다. 잠시 후 다시 시도하세요.');
    expect(result).not.toContain('secret-db-host');
  });

  it('이미 안전하게 정의한 연결 실패 안내는 유지한다', async () => {
    process.env.DATABASE_URL ||= 'postgresql://test:test@127.0.0.1:1/test';
    const { describeDbError } = await import('./db.js');
    expect(describeDbError({ code: 'P1001' })).toContain('데이터베이스 서버에 연결할 수 없습니다');
  });
});
