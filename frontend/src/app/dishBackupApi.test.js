import { describe, it, expect } from 'vitest';
import { describeTrashTiming, getBackupMode } from './dishBackupApi';

const DAY = 24 * 60 * 60 * 1000;
const NOW = Date.parse('2026-10-14T12:00:00Z');
const at = (offsetDays) => new Date(NOW + offsetDays * DAY).toISOString();

describe('describeTrashTiming', () => {
  it('formats "Deleted N days ago · removed in M days"', () => {
    const trashedAt = at(-3.2);
    const expiresAt = at(-3.2 + 30);
    expect(describeTrashTiming(trashedAt, expiresAt, NOW)).toBe('Deleted 3 days ago · removed in 27 days');
  });

  it('handles today, one day and the last day', () => {
    expect(describeTrashTiming(at(-0.1), at(29.9), NOW)).toBe('Deleted today · removed in 30 days');
    expect(describeTrashTiming(at(-1.5), at(28.5), NOW)).toBe('Deleted 1 day ago · removed in 29 days');
    expect(describeTrashTiming(at(-29.5), at(0.5), NOW)).toBe('Deleted 29 days ago · removed within a day');
  });

  it('skips missing or invalid dates', () => {
    expect(describeTrashTiming(null, at(10), NOW)).toBe('removed in 10 days');
    expect(describeTrashTiming(at(-2), 'nope', NOW)).toBe('Deleted 2 days ago');
  });
});

describe('getBackupMode', () => {
  it('maps the backup status to the delete wording', () => {
    expect(getBackupMode({ status: 'ready', available: true, enabled: true })).toBe('on');
    expect(getBackupMode({ status: 'ready', available: true, enabled: false })).toBe('off');
    expect(getBackupMode({ status: 'ready', available: false, enabled: false })).toBe('unavailable');
    expect(getBackupMode({ status: 'loading', available: false })).toBe('unavailable');
    expect(getBackupMode({ status: 'error', available: false })).toBe('unavailable');
    expect(getBackupMode(null)).toBe('unavailable');
  });
});
