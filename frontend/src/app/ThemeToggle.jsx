import React from 'react';
import { useTheme } from './ThemeContext';

/**
 * Small switch bound to ThemeContext. Rendered both in the Settings "Appearance"
 * card and in the UserMenu dropdown (quick access) - both instances share the
 * same ThemeProvider state, so toggling either one keeps the other in sync.
 */
function ThemeToggleSwitch({ id, className = '' }) {
  const { theme, toggleTheme } = useTheme();
  const isDark = theme === 'dark';

  return (
    <label className={`theme-switch ${className}`} htmlFor={id}>
      <input
        id={id}
        type="checkbox"
        role="switch"
        checked={isDark}
        onChange={toggleTheme}
        aria-label="Dark mode"
      />
      <span className="theme-switch-slider" aria-hidden="true"></span>
    </label>
  );
}

export default ThemeToggleSwitch;
