import { describe, expect, it } from 'vitest';
import { visiblePrimaryNavigation } from './Header';

describe('primary navigation permissions', () => {
  it('keeps daily work routes in order for estimators', () => {
    expect(visiblePrimaryNavigation(true, false)).toEqual([
      { path: '/', label: '업무 홈' },
      { path: '/wizard', label: '견적 작성' },
      { path: '/history', label: '견적 관리' },
    ]);
  });

  it('does not expose write routes to viewers', () => {
    expect(visiblePrimaryNavigation(false, false).map((item) => item.path)).toEqual(['/', '/history']);
  });
});
