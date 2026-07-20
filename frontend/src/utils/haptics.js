/**
 * Utility for providing haptic feedback across the application.
 * Safely falls back if vibration is unsupported or disabled by the user.
 */

const HAPTICS_KEY = 'vingo_haptics_enabled';
let lastVibration = 0;
const THROTTLE_MS = 120;

/**
 * Checks if haptics are supported in the current environment.
 * @returns {boolean}
 */
const isSupported = () => {
  return typeof navigator !== 'undefined' && 'vibrate' in navigator;
};

/**
 * Checks if the user has enabled haptics in settings.
 * Default is true.
 * @returns {boolean}
 */
export const isEnabled = () => {
  if (typeof localStorage === 'undefined') return true;
  const setting = localStorage.getItem(HAPTICS_KEY);
  return setting === null ? true : setting === 'true';
};

/**
 * Toggles the haptics setting and returns the new value.
 * @param {boolean} value
 */
export const setEnabled = (value) => {
  if (typeof localStorage !== 'undefined') {
    localStorage.setItem(HAPTICS_KEY, String(value));
  }
};

/**
 * Checks if the document is currently visible.
 * @returns {boolean}
 */
const isVisible = () => {
  return typeof document !== 'undefined' && document.visibilityState === 'visible';
};

/**
 * Checks if the user prefers reduced motion.
 * @returns {boolean}
 */
const prefersReducedMotion = () => {
  return typeof window !== 'undefined' && 
         window.matchMedia && 
         window.matchMedia('(prefers-reduced-motion: reduce)').matches;
};

/**
 * Triggers a vibration pattern if all conditions are met.
 * @param {number|number[]} pattern
 */
const trigger = (pattern) => {
  if (!isSupported() || !isEnabled() || !isVisible() || prefersReducedMotion()) {
    return;
  }

  const now = Date.now();
  if (now - lastVibration < THROTTLE_MS) {
    return;
  }
  
  lastVibration = now;

  try {
    navigator.vibrate(pattern);
  } catch (error) {
    // Silently ignore errors as requested
  }
};

export const haptics = {
  light: () => trigger(10),
  medium: () => trigger(20),
  heavy: () => trigger(40),
  success: () => trigger([20, 40, 20]),
  warning: () => trigger([30, 40, 30]),
  error: () => trigger([80, 40, 80]),
  selection: () => trigger(8),
  notification: () => trigger([15, 30, 15]),
  impact: () => trigger(25),
};
