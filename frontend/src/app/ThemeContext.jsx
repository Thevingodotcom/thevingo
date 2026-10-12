import React, { createContext, useContext, useCallback, useEffect, useState } from 'react';

// localStorage key for the persisted theme choice. Mirrors the pattern used by
// authStorage: a single well-known key, read/written defensively (private
// browsing / disabled storage must never crash the app).
export const THEME_STORAGE_KEY = 'thevingo_theme';

const ThemeContext = createContext(null);

const readStoredTheme = () => {
  try {
    const stored = window.localStorage.getItem(THEME_STORAGE_KEY);
    if (stored === 'light' || stored === 'dark') return stored;
  } catch {
    // localStorage unavailable - fall through to system preference
  }
  return null;
};

// Resolve the theme to use on first render: an explicit saved choice wins,
// otherwise fall back to the OS/browser preference so the dashboard still
// opens in dark mode for someone whose system is already dark. After this
// first read, the explicit toggle (localStorage) is always the source of truth.
// (Not exported: only ThemeProvider needs it. Keeping this file's named
// exports down to ThemeProvider + useTheme matches the AuthContext.jsx
// convention and keeps Fast Refresh happy.)
const getInitialTheme = () => {
  if (typeof window === 'undefined') return 'light';
  const stored = readStoredTheme();
  if (stored) return stored;
  try {
    if (typeof window.matchMedia === 'function' && window.matchMedia('(prefers-color-scheme: dark)').matches) {
      return 'dark';
    }
  } catch {
    // matchMedia unavailable
  }
  return 'light';
};

/**
 * Scope note: the dashboard app (DashboardLayout's .app-container and everything
 * rendered inside it - Dashboard, MenuList, Offers, Distribution, Settings, the
 * navbar/sidebar/UserMenu) is the only part of the product with a dark theme.
 * The public landing page, pricing/product pages, auth pages and the QR-scanned
 * PublicMenu keep their own light-only styling, so this provider does NOT set
 * `document.documentElement.dataset.theme`. Instead, `theme` is read by
 * DashboardLayout and applied as `data-theme` on the `.app-container` element,
 * and every dark-mode CSS override in index.css / component CSS is scoped under
 * `.app-container[data-theme="dark"] ...`. That keeps the dark palette's CSS
 * custom properties from leaking into :root (and therefore into the rest of the
 * site), while still making the theme available app-wide through this context.
 */
export const ThemeProvider = ({ children }) => {
  const [theme, setThemeState] = useState(getInitialTheme);

  useEffect(() => {
    try {
      window.localStorage.setItem(THEME_STORAGE_KEY, theme);
    } catch {
      // Best-effort persistence only
    }
  }, [theme]);

  const setTheme = useCallback((next) => {
    setThemeState(next === 'dark' ? 'dark' : 'light');
  }, []);

  const toggleTheme = useCallback(() => {
    setThemeState((prev) => (prev === 'dark' ? 'light' : 'dark'));
  }, []);

  const value = { theme, setTheme, toggleTheme };

  return (
    <ThemeContext.Provider value={value}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
};

export default ThemeContext;
