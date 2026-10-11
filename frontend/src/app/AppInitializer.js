import { API_URL } from '../config';
import authStorage, { purgeLegacyPersistentAuth } from './authStorage';

/**
 * AppInitializer handles theme setup, local settings restoration,
 * offline listeners, and JWT validation for launch flow.
 */
export const initializeApp = async () => {
  // Purge any legacy lingering persistent auth from localStorage
  purgeLegacyPersistentAuth();

  // 1. Initialize local theme / settings
  const storedTheme = localStorage.getItem('vingo_theme') || 'light';
  document.documentElement.setAttribute('data-theme', storedTheme);

  // 2. Load active session token and user session
  const token = authStorage.getToken();
  const cachedUser = authStorage.getUser();

  if (!token) {
    return {
      isValid: false,
      user: null,
      token: null,
      reason: 'NO_TOKEN'
    };
  }

  // 3. Check offline status
  if (!navigator.onLine) {
    return {
      isValid: !!cachedUser,
      user: cachedUser,
      token: token,
      reason: 'OFFLINE'
    };
  }

  // 4. Validate authentication token with backend
  try {
    const response = await fetch(`${API_URL}/api/menu/categories`, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });

    if (response.ok) {
      return {
        isValid: true,
        user: cachedUser,
        token: token,
        reason: 'VALID_TOKEN'
      };
    }

    if (response.status === 401 || response.status === 403) {
      // Expired or invalid token: purge auth state
      authStorage.clear();
      return {
        isValid: false,
        user: null,
        token: null,
        reason: 'EXPIRED_TOKEN'
      };
    }

    // Default to cached state on transient server errors
    return {
      isValid: true,
      user: cachedUser,
      token: token,
      reason: 'SERVER_WARNING'
    };
  } catch (err) {
    console.warn('Network error during app initialization, utilizing cached session:', err);
    return {
      isValid: !!cachedUser,
      user: cachedUser,
      token: token,
      reason: 'NETWORK_ERROR'
    };
  }
};
