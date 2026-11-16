import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { Prisma, PrismaClient } from '@prisma/client';
import type { DraftPayload } from '../src/types.js';
import type { DraftSaveResult } from './db.js';

// 이 테스트는 특정 localhost 임시 DB에만 허용한다. 운영 데이터에는 절대 접근하지 않는다.
const url = process.env.QUEEN_OS_TEST_DATABASE_URL;
const safe = Boolean(url && /^postgres(?:ql)?:\/\/[^/]+@(?:localhost|127\.0\.0\.1):\d+\/queen_os_ponytail_20261116(?:\?|$)/.test(url));
if (url && !safe) throw new Error('독립된 localhost 테스트 DB URL만 허용합니다.');

describe.skipIf(!safe)('saveDraft revision race (PostgreSQL integration)', () => {
  const ids: string[] = [];
  const client = new PrismaClient();
  let store: typeof import('./db.js').db;
  const payload = { step: 1, quoteTitle: '초안' } as DraftPayload;

  beforeAll(async () => {
    // Prisma dev 로컬 DB는 다중 클라이언트 연결이 불안정해, fixture 클라이언트를 닫은 뒤 앱 클라이언트를 로드한다.
    await client.$connect();
    for (let i = 0; i < 6; i++) {
      const id = 'ponytail-' + randomUUID();
      await client.draft.create({
        data: {
          id, revision: 1, payload: payload as unknown as Prisma.InputJsonValue, lastEditorId: 'test',
          revisions: { create: { revision: 1, label: '초안 생성', payload: payload as unknown as Prisma.InputJsonValue } },
        },
      });
      ids.push(id);
    }
    await client.$disconnect();
    store = (await import('./db.js')).db;
  });

  afterAll(async () => {
    if (store) for (const id of ids) await store.deleteDraft(id);
  });

  it('동일 revision의 두 저장은 OK 1건과 CONFLICT 1건, revision 2 및 이력 2건을 남긴다', async () => {
    for (const id of ids.slice(0, 5)) {
      const outcomes = await Promise.allSettled([
        store.saveDraft(id, { revision: 1, payload: { ...payload, quoteTitle: 'A' }, editorId: 'A' }),
        store.saveDraft(id, { revision: 1, payload: { ...payload, quoteTitle: 'B' }, editorId: 'B' }),
      ]);
      expect(outcomes.filter((o) => o.status === 'rejected')).toEqual([]);
      const results = outcomes.map((o) => (o as PromiseFulfilledResult<DraftSaveResult>).value);
      expect(results.map((x) => x.status).sort()).toEqual(['CONFLICT', 'OK']);
      const saved = await store.getDraftById(id);
      expect(saved?.revision).toBe(2);
      expect(saved?.history.map((r) => r.revision)).toEqual([1, 2]);
      const conflict = results.find((x) => x.status === 'CONFLICT');
      expect(conflict?.status === 'CONFLICT' && conflict.current.revision).toBe(2);
    }
  });

  it('20개를 초과하는 저장 이력은 성공한 저장 후 가장 오래된 이력부터 정리한다', async () => {
    const id = ids[5];
    for (let revision = 1; revision <= 22; revision++) {
      const result = await store.saveDraft(id, {
        revision, payload: { ...payload, quoteTitle: String(revision) }, editorId: 'test',
      });
      expect(result.status).toBe('OK');
    }
    const draft = await store.getDraftById(id);
    expect(draft?.revision).toBe(23);
    expect(draft?.history.map((entry) => entry.revision)).toEqual(
      Array.from({ length: 20 }, (_, index) => index + 4),
    );
  });
});
