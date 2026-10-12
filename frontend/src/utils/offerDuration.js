// Helpers for the offer form's duration and badge fields.
// The backend stores an offer's duration as text without a year, e.g. "Oct 12-Nov 12".

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** Date -> "YYYY-MM-DD" (value format of <input type="date">), in local time. */
export const toDateInputValue = (d) => {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

/** "2026-10-12" + "2026-11-12" -> "Oct 12-Nov 12" */
export const formatOfferDuration = (startDate, endDate) => {
  const [, sm, sd] = startDate.split('-').map(Number);
  const [, em, ed] = endDate.split('-').map(Number);
  return `${MONTHS[sm - 1]} ${String(sd).padStart(2, '0')}-${MONTHS[em - 1]} ${String(ed).padStart(2, '0')}`;
};

/**
 * "Oct 12-Nov 12" -> { startDate, endDate } as date-input values, or null when the
 * text cannot be parsed. The start is placed in `now`'s year and the end rolls over
 * to the next year when it falls before the start (e.g. "Dec 20-Jan 05").
 */
export const parseOfferDuration = (duration, now = new Date()) => {
  const match = /^\s*([A-Za-z]{3})\s*(\d{1,2})\s*-\s*([A-Za-z]{3})\s*(\d{1,2})\s*$/.exec(duration || '');
  if (!match) return null;
  const monthIndex = (m) => MONTHS.findIndex(name => name.toLowerCase() === m.toLowerCase());
  const sm = monthIndex(match[1]);
  const em = monthIndex(match[3]);
  if (sm < 0 || em < 0) return null;
  const year = now.getFullYear();
  const start = new Date(year, sm, Number(match[2]));
  let end = new Date(year, em, Number(match[4]));
  if (start.getMonth() !== sm || end.getMonth() !== em) return null; // invalid day of month
  if (end < start) end = new Date(year + 1, em, Number(match[4]));
  return { startDate: toDateInputValue(start), endDate: toDateInputValue(end) };
};

export const OFFER_BADGE_TYPES = ['combo-offer', 'discount', 'weekend-offer'];

/** Maps legacy badge ids onto the current badge options. */
export const normalizeBadgeType = (badgeType) => {
  if (badgeType === 'combo-biriyani' || badgeType === 'combo-veg') return 'combo-offer';
  if (badgeType === 'percent-paneer') return 'discount';
  if (badgeType === 'weekend-vibe') return 'weekend-offer';
  return OFFER_BADGE_TYPES.includes(badgeType) ? badgeType : 'combo-offer';
};
