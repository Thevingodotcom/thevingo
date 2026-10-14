// Pricing, validation, preview and payload helpers for the offer form.
// Mirrors the backend rules in the shared offers contract exactly:
//   - percentage: offerPrice = Math.round(price * (100 - pct)) / 100, 0 < pct < 100
//   - fixed:      per-dish offerPrice > 0 and < that dish's price, max 2 decimals
//   - combo:      comboPrice > 0, max 2 decimals, < sum of the selected dishes' prices
//   - discount needs >= 1 dish, combo needs >= 2 dishes; startDate <= endDate
// Dish prices are never modified; these helpers only compute what the offer shows.

export const OFFER_TIMEZONE = 'Asia/Kolkata';

const AMOUNT_RE = /^\d+(\.\d{1,2})?$/;
const LOOSE_NUMBER_RE = /^\d*\.?\d+$|^\d+\.?$/;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/** Rounds to cents (avoids 0.1 + 0.2 style float noise in sums). */
export const roundMoney = (value) => Math.round(Number(value) * 100) / 100;

/** Contract formula for a percentage discount. */
export const percentageOfferPrice = (price, pct) => Math.round(Number(price) * (100 - Number(pct))) / 100;

/** "280" -> "280", 89.5 -> "89.50" (decimals only when needed, like the dish cards). */
export const formatAmount = (value) => {
  const n = Number(value);
  if (!Number.isFinite(n)) return '—';
  return Number.isInteger(n) ? String(n) : n.toFixed(2);
};

/** "280 Rs" — the app's price format. */
export const formatPrice = (value) => (Number.isFinite(Number(value)) ? `${formatAmount(value)} Rs` : '—');

/**
 * Parses a user-typed amount. Returns { value, error } where error is one of
 * 'required' | 'invalid' | 'decimals'.
 */
export const parseAmount = (raw) => {
  const text = String(raw ?? '').trim();
  if (!text) return { value: null, error: 'required' };
  if (!LOOSE_NUMBER_RE.test(text)) return { value: null, error: 'invalid' };
  if (!AMOUNT_RE.test(text.replace(/^\./, '0.').replace(/\.$/, ''))) return { value: null, error: 'decimals' };
  return { value: Number(text), error: null };
};

const isValidDateString = (value) => {
  if (!DATE_RE.test(value || '')) return false;
  const [y, m, d] = value.split('-').map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  return date.getUTCFullYear() === y && date.getUTCMonth() === m - 1 && date.getUTCDate() === d;
};

/** Today's calendar date ('YYYY-MM-DD') in the offer time zone. */
export const todayInOfferTimezone = (now = new Date()) => {
  try {
    // en-CA formats as YYYY-MM-DD
    return new Intl.DateTimeFormat('en-CA', {
      timeZone: OFFER_TIMEZONE, year: 'numeric', month: '2-digit', day: '2-digit'
    }).format(now);
  } catch {
    const y = now.getFullYear();
    return `${y}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  }
};

/** '2026-01-31' + 1 month -> '2026-02-28' (clamped to the month's last day). */
export const addMonths = (dateString, months) => {
  const [y, m, d] = dateString.split('-').map(Number);
  const targetMonth = m - 1 + months;
  const lastDay = new Date(Date.UTC(y, targetMonth + 1, 0)).getUTCDate();
  const date = new Date(Date.UTC(y, targetMonth, Math.min(d, lastDay)));
  return date.toISOString().slice(0, 10);
};

/** Whole days from `from` to `to` (both 'YYYY-MM-DD'). */
export const daysBetween = (from, to) => {
  const toUtc = (s) => {
    const [y, m, d] = s.split('-').map(Number);
    return Date.UTC(y, m - 1, d);
  };
  return Math.round((toUtc(to) - toUtc(from)) / 86400000);
};

/** '2026-10-14' -> 'Oct 14, 2026' */
export const formatOfferDate = (dateString) => {
  if (!isValidDateString(dateString)) return '';
  const [y, m, d] = dateString.split('-').map(Number);
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return `${months[m - 1]} ${d}, ${y}`;
};

/** Contract `effectiveStatus`, computed the same way the backend does. */
export const computeEffectiveStatus = ({ isActive, startDate, endDate }, today = todayInOfferTimezone()) => {
  if (!isActive) return 'inactive';
  if (!startDate || !endDate) return 'unscheduled';
  if (today < startDate) return 'scheduled';
  if (today > endDate) return 'expired';
  return 'active';
};

export const OFFER_STATUS_LABELS = {
  active: 'Active',
  scheduled: 'Scheduled',
  expired: 'Expired',
  inactive: 'Inactive',
  unscheduled: 'Not scheduled'
};

/** Status shown in the offers list: the server's effectiveStatus, else the toggle. */
export const getOfferStatusKey = (offer) => {
  if (offer?.effectiveStatus && OFFER_STATUS_LABELS[offer.effectiveStatus]) return offer.effectiveStatus;
  const on = offer?.isActive === true || String(offer?.status || '').toLowerCase() === 'active';
  return on ? 'active' : 'inactive';
};

/** Map of dishId -> { id, name, price, isVeg, categoryId, categoryName } from App's categories. */
export const buildDishLookup = (categories) => {
  const lookup = new Map();
  (Array.isArray(categories) ? categories : []).forEach(cat => {
    (Array.isArray(cat?.items) ? cat.items : []).forEach(item => {
      if (item?.id == null) return;
      lookup.set(String(item.id), {
        id: String(item.id),
        name: item.name,
        price: Number(item.price),
        isVeg: item.isVeg,
        categoryId: cat.id,
        categoryName: cat.name
      });
    });
  });
  return lookup;
};

/**
 * Validates the offer draft.
 * draft: { name, offerType, discountMode, discountPercentage, comboPrice, startDate, endDate,
 *          selectedIds: string[], fixedPrices: { [dishId]: string } }
 * Returns { valid, errors } where errors may contain: name, dates, dishes, discountPercentage,
 * comboPrice, fixedPrices: { [dishId]: message }.
 */
export const validateOfferDraft = (draft, lookup) => {
  const errors = {};
  const ids = [...new Set((draft.selectedIds || []).map(String))];
  const dishes = ids.map(id => lookup.get(id)).filter(Boolean);

  if (!String(draft.name || '').trim()) errors.name = 'Enter an offer name.';

  if (!isValidDateString(draft.startDate) || !isValidDateString(draft.endDate)) {
    errors.dates = 'Choose a start and an end date.';
  } else if (draft.startDate > draft.endDate) {
    errors.dates = 'End date must be on or after the start date.';
  }

  if (dishes.length !== ids.length) errors.dishes = 'Some selected dishes are no longer on your menu.';

  if (draft.offerType === 'combo') {
    if (dishes.length < 2) errors.dishes = errors.dishes || 'Select at least 2 dishes for a combo.';
    const { value, error } = parseAmount(draft.comboPrice);
    const originalTotal = roundMoney(dishes.reduce((sum, d) => sum + d.price, 0));
    if (error === 'required') errors.comboPrice = 'Enter the combo price.';
    else if (error === 'decimals') errors.comboPrice = 'Use at most 2 decimal places.';
    else if (error || !(value > 0)) errors.comboPrice = 'Combo price must be greater than 0.';
    else if (dishes.length >= 2 && !(value < originalTotal)) {
      errors.comboPrice = `Combo price must be less than the dishes' total (${formatPrice(originalTotal)}).`;
    }
  } else {
    if (dishes.length < 1) errors.dishes = errors.dishes || 'Select at least 1 dish.';
    if (draft.discountMode === 'fixed') {
      const fixedErrors = {};
      dishes.forEach(dish => {
        const { value, error } = parseAmount(draft.fixedPrices?.[dish.id]);
        if (error === 'required') fixedErrors[dish.id] = 'Enter an offer price.';
        else if (error === 'decimals') fixedErrors[dish.id] = 'Use at most 2 decimal places.';
        else if (error || !(value > 0)) fixedErrors[dish.id] = 'Must be greater than 0.';
        else if (!(value < dish.price)) fixedErrors[dish.id] = `Must be less than ${formatPrice(dish.price)}.`;
      });
      if (Object.keys(fixedErrors).length) errors.fixedPrices = fixedErrors;
    } else {
      const { value, error } = parseAmount(draft.discountPercentage);
      if (error === 'required') errors.discountPercentage = 'Enter the discount percentage.';
      else if (error === 'decimals') errors.discountPercentage = 'Use at most 2 decimal places.';
      else if (error || !(value > 0 && value < 100)) errors.discountPercentage = 'Discount must be more than 0% and less than 100%.';
    }
  }

  return { valid: Object.keys(errors).length === 0, errors };
};

/**
 * Preview numbers for a valid draft.
 * Discount: { rows: [{ dishId, name, categoryName, originalPrice, offerPrice, savings }], dishCount,
 *             originalTotal, offerTotal, totalSavings, percentOff }
 * Combo:    same rows (offerPrice null) plus comboPrice; offerTotal = comboPrice.
 */
export const buildOfferPreview = (draft, lookup) => {
  const ids = [...new Set((draft.selectedIds || []).map(String))];
  const dishes = ids.map(id => lookup.get(id)).filter(Boolean);
  const originalTotal = roundMoney(dishes.reduce((sum, d) => sum + d.price, 0));
  const percentOff = (savings) => (originalTotal > 0 ? Math.round((savings / originalTotal) * 100) : 0);

  if (draft.offerType === 'combo') {
    const comboPrice = Number(draft.comboPrice);
    const totalSavings = roundMoney(originalTotal - comboPrice);
    return {
      offerType: 'combo',
      rows: dishes.map(d => ({
        dishId: d.id, name: d.name, categoryName: d.categoryName,
        originalPrice: d.price, offerPrice: null, savings: null
      })),
      dishCount: dishes.length,
      originalTotal,
      comboPrice,
      offerTotal: comboPrice,
      totalSavings,
      percentOff: percentOff(totalSavings)
    };
  }

  const rows = dishes.map(d => {
    const offerPrice = draft.discountMode === 'fixed'
      ? Number(draft.fixedPrices?.[d.id])
      : percentageOfferPrice(d.price, draft.discountPercentage);
    return {
      dishId: d.id, name: d.name, categoryName: d.categoryName,
      originalPrice: d.price, offerPrice, savings: roundMoney(d.price - offerPrice)
    };
  });
  const offerTotal = roundMoney(rows.reduce((sum, r) => sum + r.offerPrice, 0));
  const totalSavings = roundMoney(originalTotal - offerTotal);
  return {
    offerType: 'discount',
    discountMode: draft.discountMode === 'fixed' ? 'fixed' : 'percentage',
    discountPercentage: draft.discountMode === 'fixed' ? null : Number(draft.discountPercentage),
    rows,
    dishCount: rows.length,
    originalTotal,
    offerTotal,
    totalSavings,
    percentOff: percentOff(totalSavings)
  };
};

/** Request body for POST/PUT /api/offers (contract fields only). */
export const buildOfferPayload = (draft, { badgeType, timing, isActive }) => {
  const ids = [...new Set((draft.selectedIds || []).map(String))];
  const payload = {
    name: String(draft.name || '').trim(),
    badgeType,
    timing,
    isActive: isActive !== false,
    offerType: draft.offerType === 'combo' ? 'combo' : 'discount',
    startDate: draft.startDate,
    endDate: draft.endDate
  };
  if (payload.offerType === 'combo') {
    payload.comboPrice = Number(draft.comboPrice);
    payload.dishes = ids.map(dishId => ({ dishId }));
  } else if (draft.discountMode === 'fixed') {
    payload.discountMode = 'fixed';
    payload.dishes = ids.map(dishId => ({ dishId, offerPrice: Number(draft.fixedPrices?.[dishId]) }));
  } else {
    payload.discountMode = 'percentage';
    payload.discountPercentage = Number(draft.discountPercentage);
    payload.dishes = ids.map(dishId => ({ dishId }));
  }
  return payload;
};

/** Short price summary for a list row ("10% off", "Fixed prices", "150 Rs"), legacy text otherwise. */
export const describeOfferPrice = (offer) => {
  if (offer?.offerType === 'combo' && offer.comboPrice != null) return formatPrice(offer.comboPrice);
  if (offer?.offerType === 'discount' && offer.discountMode === 'percentage' && offer.discountPercentage != null) {
    return `${Number(offer.discountPercentage)}% off`;
  }
  if (offer?.offerType === 'discount' && offer.discountMode === 'fixed') return 'Fixed prices';
  return offer?.pricePercent || '—';
};
