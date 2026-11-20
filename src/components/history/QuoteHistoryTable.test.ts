import { describe, expect, it } from 'vitest';
import { canDeleteQuote } from './QuoteHistoryTable';

describe('quote history permissions', () => {
  it('does not expose destructive actions to read-only users', () => {
    expect(canDeleteQuote(false)).toBe(false);
  });

  it('allows editors to delete after the UI confirmation', () => {
    expect(canDeleteQuote(true)).toBe(true);
  });
});
