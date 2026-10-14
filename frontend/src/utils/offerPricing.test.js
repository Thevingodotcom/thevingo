import { describe, it, expect } from 'vitest';
import {
  addMonths,
  buildDishLookup,
  buildOfferPayload,
  buildOfferPreview,
  computeEffectiveStatus,
  daysBetween,
  describeOfferPrice,
  formatOfferDate,
  formatPrice,
  getOfferStatusKey,
  parseAmount,
  percentageOfferPrice,
  todayInOfferTimezone,
  validateOfferDraft
} from './offerPricing';

const categories = [
  {
    id: '1',
    name: 'Starters',
    items: [
      { id: '11', name: 'Paneer Tikka', price: 200, isVeg: true },
      { id: '12', name: 'Chicken 65', price: 249.99, isVeg: false }
    ]
  },
  { id: '2', name: 'Mains', items: [{ id: 21, name: 'Biryani', price: 300 }] },
  { id: '3', name: 'Empty' }
];
const lookup = buildDishLookup(categories);

const baseDraft = {
  name: 'Festive',
  offerType: 'discount',
  discountMode: 'percentage',
  discountPercentage: '10',
  comboPrice: '',
  startDate: '2026-10-14',
  endDate: '2026-11-14',
  selectedIds: ['11'],
  fixedPrices: {}
};
const errorsOf = (overrides) => validateOfferDraft({ ...baseDraft, ...overrides }, lookup).errors;

describe('percentageOfferPrice (contract formula)', () => {
  it('rounds to cents with Math.round(price * (100 - pct)) / 100', () => {
    expect(percentageOfferPrice(200, 10)).toBe(180);
    expect(percentageOfferPrice(249.99, 15)).toBe(212.49); // 21249.15 -> 21249
    expect(percentageOfferPrice(99, 33)).toBe(66.33);
    expect(percentageOfferPrice(10.05, 50)).toBe(5.03); // 502.5 rounds half up
    expect(percentageOfferPrice(1, 99.99)).toBe(0); // 0.01 -> rounds to 0
    expect(percentageOfferPrice('120', '12.5')).toBe(105);
  });
});

describe('parseAmount', () => {
  it('accepts up to 2 decimals', () => {
    expect(parseAmount('150')).toEqual({ value: 150, error: null });
    expect(parseAmount(' 99.5 ')).toEqual({ value: 99.5, error: null });
    expect(parseAmount('0.75')).toEqual({ value: 0.75, error: null });
    expect(parseAmount('.5')).toEqual({ value: 0.5, error: null });
  });

  it('flags empty, non-numeric and >2 decimal input', () => {
    expect(parseAmount('').error).toBe('required');
    expect(parseAmount(undefined).error).toBe('required');
    expect(parseAmount('abc').error).toBe('invalid');
    expect(parseAmount('-5').error).toBe('invalid');
    expect(parseAmount('1e3').error).toBe('invalid');
    expect(parseAmount('10.123').error).toBe('decimals');
  });
});

describe('validateOfferDraft', () => {
  it('accepts a valid percentage discount', () => {
    expect(validateOfferDraft(baseDraft, lookup)).toEqual({ valid: true, errors: {} });
  });

  it('requires a name', () => {
    expect(errorsOf({ name: '   ' }).name).toBeTruthy();
  });

  it('requires valid dates with start <= end (same day allowed)', () => {
    expect(errorsOf({ startDate: '' }).dates).toBeTruthy();
    expect(errorsOf({ endDate: '2026-02-30' }).dates).toBeTruthy();
    expect(errorsOf({ startDate: '2026-11-15', endDate: '2026-11-14' }).dates).toMatch(/on or after/);
    expect(errorsOf({ startDate: '2026-11-14', endDate: '2026-11-14' }).dates).toBeUndefined();
  });

  it('percentage must be strictly between 0 and 100', () => {
    expect(errorsOf({ discountPercentage: '' }).discountPercentage).toBeTruthy();
    expect(errorsOf({ discountPercentage: '0' }).discountPercentage).toBeTruthy();
    expect(errorsOf({ discountPercentage: '100' }).discountPercentage).toBeTruthy();
    expect(errorsOf({ discountPercentage: '0.01' }).discountPercentage).toBeUndefined();
    expect(errorsOf({ discountPercentage: '99.99' }).discountPercentage).toBeUndefined();
    expect(errorsOf({ discountPercentage: '12.345' }).discountPercentage).toMatch(/2 decimal/);
  });

  it('discount needs at least 1 dish', () => {
    expect(errorsOf({ selectedIds: [] }).dishes).toMatch(/at least 1/);
  });

  it('fixed price must be > 0, < the dish price and have at most 2 decimals', () => {
    const fixed = (prices) => errorsOf({
      discountMode: 'fixed', selectedIds: ['11', '12'], fixedPrices: prices
    }).fixedPrices;
    expect(fixed({ 11: '150', 12: '249.98' })).toBeUndefined();
    expect(fixed({ 11: '200', 12: '100' })).toEqual({ 11: 'Must be less than 200 Rs.' });
    expect(fixed({ 11: '0', 12: '100' })[11]).toMatch(/greater than 0/);
    expect(fixed({ 11: '150' })[12]).toMatch(/Enter an offer price/);
    expect(fixed({ 11: '150', 12: '249.999' })[12]).toMatch(/2 decimal/);
    expect(fixed({ 11: '0.01', 12: '249.99' })[12]).toBe('Must be less than 249.99 Rs.');
  });

  it('combo needs at least 2 dishes and a price below the original total', () => {
    const combo = (overrides) => errorsOf({ offerType: 'combo', selectedIds: ['11', '21'], comboPrice: '450', ...overrides });
    expect(combo({})).toEqual({});
    expect(combo({ selectedIds: ['11'] }).dishes).toMatch(/at least 2/);
    expect(combo({ comboPrice: '500' }).comboPrice).toMatch(/less than the dishes' total \(500 Rs\)/);
    expect(combo({ comboPrice: '499.99' }).comboPrice).toBeUndefined();
    expect(combo({ comboPrice: '0' }).comboPrice).toMatch(/greater than 0/);
    expect(combo({ comboPrice: '' }).comboPrice).toMatch(/Enter the combo price/);
    expect(combo({ comboPrice: '10.555' }).comboPrice).toMatch(/2 decimal/);
  });

  it('combo total uses cent-rounded sums', () => {
    // 249.99 + 200 = 449.99
    const errors = errorsOf({ offerType: 'combo', selectedIds: ['11', '12'], comboPrice: '449.99' });
    expect(errors.comboPrice).toMatch(/449.99 Rs/);
  });

  it('flags selected dishes that are not on the menu', () => {
    expect(errorsOf({ selectedIds: ['11', '999'] }).dishes).toMatch(/no longer on your menu/);
  });
});

describe('buildOfferPreview', () => {
  it('computes percentage rows and totals', () => {
    const preview = buildOfferPreview({ ...baseDraft, selectedIds: ['11', '12'], discountPercentage: '15' }, lookup);
    expect(preview.rows).toEqual([
      { dishId: '11', name: 'Paneer Tikka', categoryName: 'Starters', originalPrice: 200, offerPrice: 170, savings: 30 },
      { dishId: '12', name: 'Chicken 65', categoryName: 'Starters', originalPrice: 249.99, offerPrice: 212.49, savings: 37.5 }
    ]);
    expect(preview).toMatchObject({
      offerType: 'discount', discountMode: 'percentage', discountPercentage: 15,
      dishCount: 2, originalTotal: 449.99, offerTotal: 382.49, totalSavings: 67.5, percentOff: 15
    });
  });

  it('computes fixed rows', () => {
    const preview = buildOfferPreview({
      ...baseDraft, discountMode: 'fixed', selectedIds: ['11', '21'], fixedPrices: { 11: '150', 21: '255.5' }
    }, lookup);
    expect(preview.rows.map(r => [r.offerPrice, r.savings])).toEqual([[150, 50], [255.5, 44.5]]);
    expect(preview).toMatchObject({ discountMode: 'fixed', discountPercentage: null, originalTotal: 500, offerTotal: 405.5, totalSavings: 94.5, percentOff: 19 });
  });

  it('computes combo totals', () => {
    const preview = buildOfferPreview({ ...baseDraft, offerType: 'combo', selectedIds: ['11', '21'], comboPrice: '400' }, lookup);
    expect(preview).toMatchObject({
      offerType: 'combo', dishCount: 2, originalTotal: 500, comboPrice: 400, offerTotal: 400, totalSavings: 100, percentOff: 20
    });
    expect(preview.rows[1]).toMatchObject({ dishId: '21', originalPrice: 300, offerPrice: null });
  });
});

describe('buildOfferPayload', () => {
  const meta = { badgeType: 'discount', timing: 'L/D', isActive: true };

  it('percentage discount', () => {
    expect(buildOfferPayload({ ...baseDraft, name: ' Festive ', selectedIds: ['11', '12', '11'] }, meta)).toEqual({
      name: 'Festive', badgeType: 'discount', timing: 'L/D', isActive: true,
      offerType: 'discount', startDate: '2026-10-14', endDate: '2026-11-14',
      discountMode: 'percentage', discountPercentage: 10,
      dishes: [{ dishId: '11' }, { dishId: '12' }]
    });
  });

  it('fixed discount sends a per-dish offerPrice', () => {
    const payload = buildOfferPayload({ ...baseDraft, discountMode: 'fixed', selectedIds: ['11'], fixedPrices: { 11: '150.5' } }, meta);
    expect(payload.discountMode).toBe('fixed');
    expect(payload).not.toHaveProperty('discountPercentage');
    expect(payload.dishes).toEqual([{ dishId: '11', offerPrice: 150.5 }]);
  });

  it('combo sends comboPrice and no discount fields', () => {
    const payload = buildOfferPayload({ ...baseDraft, offerType: 'combo', comboPrice: '400', selectedIds: ['11', '21'] }, { ...meta, isActive: false });
    expect(payload).toEqual({
      name: 'Festive', badgeType: 'discount', timing: 'L/D', isActive: false,
      offerType: 'combo', startDate: '2026-10-14', endDate: '2026-11-14',
      comboPrice: 400, dishes: [{ dishId: '11' }, { dishId: '21' }]
    });
  });
});

describe('scheduling helpers', () => {
  it('computes effectiveStatus like the backend (end date inclusive)', () => {
    const offer = { isActive: true, startDate: '2026-10-10', endDate: '2026-10-20' };
    expect(computeEffectiveStatus(offer, '2026-10-09')).toBe('scheduled');
    expect(computeEffectiveStatus(offer, '2026-10-10')).toBe('active');
    expect(computeEffectiveStatus(offer, '2026-10-20')).toBe('active');
    expect(computeEffectiveStatus(offer, '2026-10-21')).toBe('expired');
    expect(computeEffectiveStatus({ ...offer, isActive: false }, '2026-10-15')).toBe('inactive');
    expect(computeEffectiveStatus({ isActive: true, startDate: null, endDate: null }, '2026-10-15')).toBe('unscheduled');
  });

  it('uses Asia/Kolkata for today', () => {
    // 20:00 UTC on Oct 14 is already Oct 15 in India (UTC+5:30)
    expect(todayInOfferTimezone(new Date('2026-10-14T20:00:00Z'))).toBe('2026-10-15');
    expect(todayInOfferTimezone(new Date('2026-10-14T18:00:00Z'))).toBe('2026-10-14');
  });

  it('adds months (clamped) and counts days', () => {
    expect(addMonths('2026-10-14', 1)).toBe('2026-11-14');
    expect(addMonths('2026-01-31', 1)).toBe('2026-02-28');
    expect(addMonths('2026-12-15', 1)).toBe('2027-01-15');
    expect(daysBetween('2026-10-14', '2026-10-20')).toBe(6);
  });

  it('formats dates and prices', () => {
    expect(formatOfferDate('2026-10-05')).toBe('Oct 5, 2026');
    expect(formatPrice(280)).toBe('280 Rs');
    expect(formatPrice(89.5)).toBe('89.50 Rs');
  });

  it('status key prefers effectiveStatus, else the toggle', () => {
    expect(getOfferStatusKey({ isActive: true, effectiveStatus: 'scheduled' })).toBe('scheduled');
    expect(getOfferStatusKey({ isActive: true, status: 'Active' })).toBe('active');
    expect(getOfferStatusKey({ isActive: false, status: 'Inactive' })).toBe('inactive');
  });

  it('describes the price for list rows', () => {
    expect(describeOfferPrice({ offerType: 'discount', discountMode: 'percentage', discountPercentage: 12.5 })).toBe('12.5% off');
    expect(describeOfferPrice({ offerType: 'discount', discountMode: 'fixed' })).toBe('Fixed prices');
    expect(describeOfferPrice({ offerType: 'combo', comboPrice: 499 })).toBe('499 Rs');
    expect(describeOfferPrice({ offerType: 'discount', discountMode: null, pricePercent: '15%' })).toBe('15%');
  });
});

describe('buildDishLookup', () => {
  it('indexes dishes by string id with their category', () => {
    expect(lookup.get('21')).toMatchObject({ id: '21', name: 'Biryani', price: 300, categoryName: 'Mains' });
    expect(lookup.size).toBe(3);
  });
});
