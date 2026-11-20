import { describe, expect, it } from 'vitest';
import { recentByUpdatedAt, STEP_LABELS } from './WorkOverview';

describe('work overview data', () => {
  it('shows the most recently updated work first without mutating API data', () => {
    const input = [
      { id: 'old', updatedAt: '2026-11-18T00:00:00.000Z' },
      { id: 'new', updatedAt: '2026-11-20T00:00:00.000Z' },
    ];
    expect(recentByUpdatedAt(input).map((item) => item.id)).toEqual(['new', 'old']);
    expect(input.map((item) => item.id)).toEqual(['old', 'new']);
  });

  it('keeps the critical quote flow labels in order', () => {
    expect([1, 2, 3, 4].map((step) => STEP_LABELS[step])).toEqual([
      '자료 입력', '규격 검수', '원가 계산', '견적서 발행',
    ]);
  });
});
