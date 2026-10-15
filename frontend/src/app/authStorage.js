/**
 * authStorage.js
 * Centralized session-scoped authentication storage manager.
 * Ensures authentication credentials (token and user state) are strictly
 * bound to the active browsing session (sessionStorage), preventing session
 * persistence across closed browser tabs or newly opened browsing sessions.
 * 
 * Also proactively purges any legacy persistent auth keys from localStorage.
 */

const TOKEN_KEY = 'token';
const USER_KEY = 'user';
const SESSION_LAUNCHED_KEY = 'vingo_session_launched';

// Purge any lingering legacy persistent tokens from localStorage
export const purgeLegacyPersistentAuth = () => {
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.removeItem(TOKEN_KEY);
      localStorage.removeItem(USER_KEY);
    }
  } catch (err) {
    // Storage access might be restricted in some environments
  }
};

// Immediately execute cleanup of legacy persistent credentials on script evaluation
purgeLegacyPersistentAuth();

export const authStorage = {
  getToken: () => {
    try {
      if (typeof sessionStorage !== 'undefined') {
        return sessionStorage.getItem(TOKEN_KEY) || null;
      }
    } catch {
      // Fallback if sessionStorage is blocked
    }
    return null;
  },

  setToken: (token) => {
    try {
      if (typeof sessionStorage !== 'undefined') {
        if (token) {
          sessionStorage.setItem(TOKEN_KEY, token);
        } else {
          sessionStorage.removeItem(TOKEN_KEY);
        }
      }
    } catch {}
    // Ensure localStorage never retains the token
    purgeLegacyPersistentAuth();
  },

  getUser: () => {
    try {
      if (typeof sessionStorage !== 'undefined') {
        const raw = sessionStorage.getItem(USER_KEY);
        return raw ? JSON.parse(raw) : null;
      }
    } catch {
      return null;
    }
    return null;
  },

  setUser: (user) => {
    try {
      if (typeof sessionStorage !== 'undefined') {
        if (user) {
          sessionStorage.setItem(USER_KEY, JSON.stringify(user));
        } else {
          sessionStorage.removeItem(USER_KEY);
        }
      }
    } catch {}
    // Ensure localStorage never retains the user
    purgeLegacyPersistentAuth();
  },

  removeToken: () => {
    try {
      if (typeof sessionStorage !== 'undefined') {
        sessionStorage.removeItem(TOKEN_KEY);
      }
    } catch {}
    try {
      if (typeof localStorage !== 'undefined') {
        localStorage.removeItem(TOKEN_KEY);
      }
    } catch {}
  },

  removeUser: () => {
    try {
      if (typeof sessionStorage !== 'undefined') {
        sessionStorage.removeItem(USER_KEY);
      }
    } catch {}
    try {
      if (typeof localStorage !== 'undefined') {
        localStorage.removeItem(USER_KEY);
      }
    } catch {}
  },

  clear: () => {
    try {
      if (typeof sessionStorage !== 'undefined') {
        sessionStorage.removeItem(TOKEN_KEY);
        sessionStorage.removeItem(USER_KEY);
        sessionStorage.removeItem(SESSION_LAUNCHED_KEY);
      }
    } catch {}
    try {
      if (typeof localStorage !== 'undefined') {
        localStorage.removeItem(TOKEN_KEY);
        localStorage.removeItem(USER_KEY);
      }
    } catch {}
  }
};

export default authStorage;
