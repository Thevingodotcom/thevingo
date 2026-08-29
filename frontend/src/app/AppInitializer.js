import { API_URL } from '../config';

/**
 * AppInitializer handles theme setup, local settings restoration,
 * offline listeners, and JWT validation for launch flow.
 */
export const initializeApp = async () => {
  // 1. Initialize local theme / settings
  const storedTheme = localStorage.getItem('vingo_theme') || 'light';
  document.documentElement.setAttribute('data-theme', storedTheme);

  // 2. Load cached authentication token and user session
  const token = localStorage.getItem('token');
  const cachedUserStr = localStorage.getItem('user');
  let cachedUser = null;

  if (cachedUserStr) {
    try {
      cachedUser = JSON.parse(cachedUserStr);
    } catch (e) {
      console.warn('Corrupted cached user state, clearing session.', e);
      localStorage.removeItem('user');
    }
  }

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
      localStorage.removeItem('token');
      localStorage.removeItem('user');
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
