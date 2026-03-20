import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { formatCommitDate } from './commit-info';

describe('formatCommitDate', () => {
  const now = new Date('2026-03-24T12:00:00Z');

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(now);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('returns "this minute" for dates less than 1 minute ago', () => {
    const date = new Date(now.getTime() - 30_000);
    expect(formatCommitDate(date)).toBe('this minute');
  });

  it('returns minutes ago for dates less than 1 hour ago', () => {
    const date = new Date(now.getTime() - 5 * 60_000);
    expect(formatCommitDate(date)).toBe('5 minutes ago');
  });

  it('returns "1 minute ago" for exactly 1 minute ago', () => {
    const date = new Date(now.getTime() - 60_000);
    expect(formatCommitDate(date)).toBe('1 minute ago');
  });

  it('returns hours ago for dates less than 24 hours ago', () => {
    const date = new Date(now.getTime() - 3 * 3_600_000);
    expect(formatCommitDate(date)).toBe('3 hours ago');
  });

  it('returns days ago for dates less than 30 days ago', () => {
    const date = new Date(now.getTime() - 7 * 86_400_000);
    expect(formatCommitDate(date)).toBe('7 days ago');
  });

  it('returns a localized date string for dates 30+ days ago', () => {
    const date = new Date(now.getTime() - 45 * 86_400_000);
    expect(formatCommitDate(date)).toBe(date.toLocaleDateString());
  });
});
