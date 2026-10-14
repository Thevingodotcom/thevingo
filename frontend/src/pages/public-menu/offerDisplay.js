// Pure helpers for showing published offers on the public menu.
// The public menu API (GET /api/menu/public/:slug) adds, per the offers contract:
//   - dish.offer: null | { offerId, title, badgeType, type: 'discount', discountMode, discountPercentage,
//                          originalPrice, offerPrice, savings, endDate }
//   - dish.comboIds: ['26', ...]
//   - top-level combos: [{ id, title, badgeType, comboPrice, originalTotal, savings, endDate, timing,
//                          dishes: [{ id, name, price, image, isVeg }] }]
// Older backends omit all three, and every helper here then falls back to "no offer".

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

const toNumber = (value) => {
  if (value === null || value === undefined || value === '') return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
};

const roundCents = (n) => Math.round(n * 100) / 100;

/**
 * Formats an amount the way the public menu prints prices ("280" -> "280", "199.5" -> "199.50").
 * Callers append the menu's " Rs" suffix.
 */
export const formatPrice = (value) => {
  const n = toNumber(value);
  if (n === null) return '';
  const rounded = roundCents(n);
  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(2);
};

/**
 * Collapses the owner-facing badge ids (including legacy ones) into the three badge looks the
 * Offers page offers: 'combo' (blue round badge; 'combo-veg' gets the darker blue), 'discount'
 * (red % tag) and 'weekend' (red WEEKEND OFFER block).
 */
export const getBadgeStyle = (badgeType, fallback = 'discount') => {
  switch (badgeType) {
    case 'combo-offer':
    case 'combo-biriyani':
      return 'combo';
    case 'combo-veg':
      return 'combo-veg';
    case 'discount':
    case 'percent-paneer':
      return 'discount';
    case 'weekend-offer':
    case 'weekend-vibe':
      return 'weekend';
    default:
      return fallback;
  }
};

const formatPercent = (pct) => String(roundCents(pct));

/** "2026-11-13" -> "13 Nov" (adds the year when it is not `now`'s year); null when unparseable. */
export const formatValidTill = (endDate, now = new Date()) => {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(typeof endDate === 'string' ? endDate.trim() : '');
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  const base = `${day} ${MONTHS[month - 1]}`;
  return year === now.getFullYear() ? base : `${base} ${year}`;
};

const TIMING_NAMES = { B: 'Breakfast', L: 'Lunch', D: 'Dinner' };

/** Offer timing codes ("B/L/D", "L/D", ...) -> "Breakfast/Lunch/Dinner"; other text is returned as is. */
export const formatTiming = (timing) => {
  if (typeof timing !== 'string' || !timing.trim()) return '';
  const parts = timing.split('/').map(p => p.trim().toUpperCase());
  if (parts.every(p => TIMING_NAMES[p])) return parts.map(p => TIMING_NAMES[p]).join('/');
  return timing.trim();
};

/**
 * Normalizes dish.offer into what the dish card renders, or null when the dish has no usable offer
 * (missing on older backends, malformed, or not actually cheaper than the dish's price).
 */
export const getDishOffer = (item) => {
  const offer = item && item.offer;
  if (!offer || typeof offer !== 'object') return null;

  const offerPrice = toNumber(offer.offerPrice);
  const originalPrice = toNumber(offer.originalPrice) ?? toNumber(item.price);
  if (offerPrice === null || originalPrice === null || offerPrice < 0 || offerPrice >= originalPrice) {
    return null;
  }

  const savingsFromApi = toNumber(offer.savings);
  const savings = savingsFromApi !== null && savingsFromApi > 0
    ? savingsFromApi
    : roundCents(originalPrice - offerPrice);

  const pct = toNumber(offer.discountPercentage);
  const isPercentage = offer.discountMode !== 'fixed' && pct !== null && pct > 0 && pct < 100;
  const style = getBadgeStyle(offer.badgeType, 'discount');

  return {
    id: offer.offerId != null ? String(offer.offerId) : '',
    title: typeof offer.title === 'string' ? offer.title.trim() : '',
    style,
    label: isPercentage ? `${formatPercent(pct)}% OFF` : 'Offer price',
    originalPrice,
    offerPrice,
    savings,
    endDate: offer.endDate || null,
  };
};

/** DOM id of a combo card (target of the dishes' "Part of a combo" chips). */
export const comboAnchorId = (comboId) => `public-combo-${comboId}`;

/** The dish's combo ids as strings ([] when missing). */
export const getComboIds = (item) =>
  (item && Array.isArray(item.comboIds) ? item.comboIds : [])
    .filter(id => id !== null && id !== undefined && id !== '')
    .map(String);

/** Validates/normalizes the top-level `combos` array; anything unusable is dropped. */
export const normalizeCombos = (combos) => {
  if (!Array.isArray(combos)) return [];
  return combos
    .map(combo => {
      if (!combo || typeof combo !== 'object' || combo.id === null || combo.id === undefined) return null;
      const comboPrice = toNumber(combo.comboPrice);
      if (comboPrice === null || comboPrice < 0) return null;
      const dishes = (Array.isArray(combo.dishes) ? combo.dishes : [])
        .filter(d => d && typeof d === 'object' && d.name)
        .map(d => ({
          id: d.id != null ? String(d.id) : '',
          name: String(d.name),
          price: toNumber(d.price),
          isVeg: d.isVeg === null || d.isVeg === undefined ? null : Boolean(d.isVeg),
        }));
      if (dishes.length === 0) return null;

      const summed = dishes.every(d => d.price !== null)
        ? roundCents(dishes.reduce((sum, d) => sum + d.price, 0))
        : null;
      const originalTotal = toNumber(combo.originalTotal) ?? summed;
      const hasSaving = originalTotal !== null && originalTotal > comboPrice;
      const savingsFromApi = toNumber(combo.savings);
      const savings = hasSaving
        ? (savingsFromApi !== null && savingsFromApi > 0 ? savingsFromApi : roundCents(originalTotal - comboPrice))
        : 0;

      return {
        id: String(combo.id),
        title: typeof combo.title === 'string' && combo.title.trim() ? combo.title.trim() : 'Combo offer',
        style: getBadgeStyle(combo.badgeType, 'combo'),
        comboPrice,
        originalTotal: hasSaving ? originalTotal : null,
        savings,
        endDate: combo.endDate || null,
        timing: combo.timing || '',
        dishes,
      };
    })
    .filter(Boolean);
};

/**
 * Applies the public menu's search / dish-type / category filters to combos:
 * - search matches the combo title or any included dish name;
 * - 'veg' keeps all-veg combos, 'non-veg' keeps combos with at least one non-veg dish;
 * - a selected category keeps combos that include a dish from that category.
 * The meal-time (availability) filter is not applied: combos carry their own timing.
 */
export const filterCombos = (combos, { searchQuery = '', dishType = 'all', selectedCategory = 'all', categories = [] } = {}) => {
  const query = searchQuery.trim().toLowerCase();

  let categoryDishIds = null;
  if (selectedCategory !== 'all') {
    categoryDishIds = new Set();
    (categories || []).forEach(category => {
      if (category && category.name === selectedCategory && Array.isArray(category.items)) {
        category.items.forEach(item => categoryDishIds.add(String(item.id)));
      }
    });
  }

  return combos.filter(combo => {
    if (query) {
      const matches = combo.title.toLowerCase().includes(query)
        || combo.dishes.some(d => d.name.toLowerCase().includes(query));
      if (!matches) return false;
    }
    // Same rule as the dish filter: anything not explicitly veg counts as non-veg.
    if (dishType === 'veg' && !combo.dishes.every(d => d.isVeg === true)) return false;
    if (dishType === 'non-veg' && combo.dishes.every(d => d.isVeg === true)) return false;
    if (categoryDishIds && !combo.dishes.some(d => categoryDishIds.has(d.id))) return false;
    return true;
  });
};
