import { describe, expect, it } from 'vitest';
import { RestoreDraftSchema } from '../src/schemas.js';

describe('RestoreDraftSchema', () => {
  it('기존 revision 없이 복원하지 못하게 한다', () => {
    expect(RestoreDraftSchema.safeParse({ revision: 1 }).success).toBe(false);
    expect(RestoreDraftSchema.safeParse({ revision: 1, expectedRevision: 0 }).success).toBe(false);
  });

  it('과거 시점과 최신 시점이 모두 있으면 수락한다', () => {
    const result = RestoreDraftSchema.safeParse({ revision: 1, expectedRevision: 3 });
    expect(result.success).toBe(true);
  });
});
