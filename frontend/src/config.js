/**
 * Global Configuration Settings
 * Automatically detects the live origin in production deployment
 * to ensure QR codes and API endpoints never default to localhost.
 */

const getAppUrl = () => {
  if (import.meta.env.VITE_APP_URL) {
    return import.meta.env.VITE_APP_URL.replace(/\/$/, '');
  }
  if (typeof window !== 'undefined' && window.location && window.location.origin) {
    return window.location.origin;
  }
  return 'http://localhost:5173';
};

const getApiUrl = () => {
  if (import.meta.env.VITE_API_URL) {
    return import.meta.env.VITE_API_URL.replace(/\/$/, '');
  }
  if (typeof window !== 'undefined' && window.location && window.location.origin) {
    // In production without explicit VITE_API_URL, fallback to same origin
    return window.location.origin;
  }
  return 'http://localhost:5000';
};

export const APP_URL = getAppUrl();
export const API_URL = getApiUrl();
/**
 * Stock photo that older builds inserted for dishes created without an image.
 * Rows still holding this URL are treated as "no image".
 */
export const LEGACY_DEFAULT_DISH_IMAGE = 'https://images.unsplash.com/photo-1565557623262-b51c2513a641?w=300&auto=format&fit=crop&q=80';

const PLACEHOLDER_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="300" height="300" viewBox="0 0 300 300"><rect width="300" height="300" fill="#f3f4f6"/><g fill="none" stroke="#c4c8cf" stroke-width="7" stroke-linecap="round" stroke-linejoin="round"><circle cx="150" cy="150" r="52"/><circle cx="150" cy="150" r="34"/><path d="M68 98v36a10 10 0 0 0 20 0V98M78 98v104"/><path d="M226 202V98c-12 6-18 24-18 44 0 8 6 12 12 12h6"/></g></svg>`;

/**
 * Neutral placeholder shown when a dish has no image (light gray tile with a
 * plate + cutlery glyph). Inline data URI so it never depends on the network.
 */
export const DEFAULT_DISH_IMAGE = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(PLACEHOLDER_SVG)}`;

/** True when the value points at a real dish image (not empty / legacy stock photo). */
export const hasDishImage = (image) => {
  if (!image || typeof image !== 'string') return false;
  const trimmed = image.trim();
  return trimmed !== '' && trimmed !== LEGACY_DEFAULT_DISH_IMAGE;
};

export const getImageUrl = (image) => {
  if (!hasDishImage(image)) {
    return DEFAULT_DISH_IMAGE;
  }

  const trimmed = image.trim();

  // If saved with localhost in DB (e.g. http://localhost:5000/uploads/...)
  if (/^https?:\/\/localhost(:\d+)?\//i.test(trimmed)) {
    const cleanApiUrl = (API_URL || '').replace(/\/$/, '');
    return trimmed.replace(/^https?:\/\/localhost(:\d+)?/i, cleanApiUrl);
  }

  // If already an absolute HTTP, HTTPS or data URI
  if (trimmed.startsWith('http://') || trimmed.startsWith('https://') || trimmed.startsWith('data:')) {
    return trimmed;
  }

  // Relative path (e.g. /uploads/xxx or uploads/xxx)
  const cleanApiUrl = (API_URL || '').replace(/\/$/, '');
  const cleanPath = trimmed.startsWith('/') ? trimmed : `/${trimmed}`;
  return `${cleanApiUrl}${cleanPath}`;
};
