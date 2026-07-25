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
export const DEFAULT_DISH_IMAGE = 'https://images.unsplash.com/photo-1565557623262-b51c2513a641?w=300&auto=format&fit=crop&q=80';
