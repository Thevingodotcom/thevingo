import React, { createContext, useContext, useState, useCallback } from 'react';
import { API_URL } from '../config';
import authStorage from './authStorage';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [currentUser, setCurrentUser] = useState(() => authStorage.getUser());
  const [token, setToken] = useState(() => authStorage.getToken());
  const [isInitializing, setIsInitializing] = useState(true);
  const [isFadingOut, setIsFadingOut] = useState(false);
  // Where ProtectedRoute should send the user once their session is gone.
  // null => '/login' (expired/invalid session); set by an explicit logout (e.g. '/').
  const [postLogoutPath, setPostLogoutPath] = useState(null);

  /**
   * Clear all session storage & local state.
   * Local state is cleared synchronously (before the server call) so that a caller
   * navigating in the same tick never renders protected routes with a dead session.
   * @param {{ redirectTo?: string }} [options] redirectTo: where ProtectedRoute should send
   *   the user if a protected page renders after this logout (defaults to '/login').
   */
  const logout = useCallback(async (options = {}) => {
    const savedToken = authStorage.getToken();
    authStorage.clear();
    setPostLogoutPath(options.redirectTo || null);
    setToken(null);
    setCurrentUser(null);

    if (savedToken) {
      try {
        await fetch(`${API_URL}/api/auth/logout`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${savedToken}`
          }
        });
      } catch {
        // Server-side logout is best-effort; the session is already cleared locally
      }
    }
  }, []);

  // Update user & token on login/register
  const login = useCallback((userData, tokenData) => {
    setPostLogoutPath(null);
    if (tokenData) {
      authStorage.setToken(tokenData);
      setToken(tokenData);
    }
    if (userData) {
      authStorage.setUser(userData);
      setCurrentUser(userData);
    }
  }, []);

  // Merge fields (e.g. a new avatar returned by the API) into the cached user & persist them
  const updateUser = useCallback((patch) => {
    if (!patch) return;
    setCurrentUser((prev) => {
      const next = { ...(prev || authStorage.getUser() || {}), ...patch };
      authStorage.setUser(next);
      return next;
    });
  }, []);

  // Session validation helper
  const validateSession = useCallback(async () => {
    const savedToken = authStorage.getToken();
    if (!savedToken) {
      authStorage.clear();
      setToken(null);
      setCurrentUser(null);
      return false;
    }

    // Check offline status
    if (!navigator.onLine) {
      const savedUser = authStorage.getUser();
      if (savedUser) {
        try {
          setCurrentUser(savedUser);
          setToken(savedToken);
          return true;
        } catch {
          // invalid cache
        }
      }
    }

    try {
      const res = await fetch(`${API_URL}/api/menu/categories`, {
        headers: { 'Authorization': `Bearer ${savedToken}` }
      });

      if (res.ok) {
        const savedUser = authStorage.getUser();
        if (savedUser) {
          setCurrentUser(savedUser);
        }
        setToken(savedToken);
        return true;
      } else if (res.status === 401 || res.status === 403) {
        // Token expired or invalid
        authStorage.clear();
        setToken(null);
        setCurrentUser(null);
        return false;
      }
      // Fail open if server error or offline
      return true;
    } catch (err) {
      // Offline fallback
      return !!savedToken;
    }
  }, []);

  const value = {
    currentUser,
    setCurrentUser,
    token,
    isInitializing,
    setIsInitializing,
    isFadingOut,
    setIsFadingOut,
    login,
    logout,
    updateUser,
    postLogoutPath,
    validateSession
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export default AuthContext;
