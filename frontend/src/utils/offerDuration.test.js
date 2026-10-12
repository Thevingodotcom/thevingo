import { describe, it, expect } from 'vitest';
import { formatOfferDuration, parseOfferDuration, normalizeBadgeType } from './offerDuration';

describe('offerDuration utils', () => {
  const now = new Date(2026, 9, 12); // Oct 12 2026

  it('formats date inputs into the stored duration text', () => {
    expect(formatOfferDuration('2026-10-05', '2026-11-12')).toBe('Oct 05-Nov 12');
  });

  it('parses stored duration text back into date inputs', () => {
    expect(parseOfferDuration('Oct 05-Nov 12', now)).toEqual({ startDate: '2026-10-05', endDate: '2026-11-12' });
    expect(parseOfferDuration('Jun 01-Jun30', now)).toEqual({ startDate: '2026-06-01', endDate: '2026-06-30' });
  });

  it('rolls the end date into the next year when it precedes the start', () => {
    expect(parseOfferDuration('Dec 20-Jan 05', now)).toEqual({ startDate: '2026-12-20', endDate: '2027-01-05' });
  });

  it('round-trips format -> parse', () => {
    const text = formatOfferDuration('2026-03-01', '2026-03-31');
    expect(parseOfferDuration(text, now)).toEqual({ startDate: '2026-03-01', endDate: '2026-03-31' });
  });

  it('returns null for unparseable text or invalid days', () => {
    expect(parseOfferDuration('', now)).toBeNull();
    expect(parseOfferDuration('All summer', now)).toBeNull();
    expect(parseOfferDuration('Feb 30-Mar 02', now)).toBeNull();
  });

  it('maps legacy badge ids onto current options', () => {
    expect(normalizeBadgeType('combo-biriyani')).toBe('combo-offer');
    expect(normalizeBadgeType('combo-veg')).toBe('combo-offer');
    expect(normalizeBadgeType('percent-paneer')).toBe('discount');
    expect(normalizeBadgeType('weekend-vibe')).toBe('weekend-offer');
    expect(normalizeBadgeType('discount')).toBe('discount');
    expect(normalizeBadgeType(undefined)).toBe('combo-offer');
  });
});
