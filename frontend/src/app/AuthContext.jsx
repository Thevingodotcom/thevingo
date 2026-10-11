import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { API_URL } from '../config';
import authStorage from './authStorage';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [currentUser, setCurrentUser] = useState(() => authStorage.getUser());
  const [token, setToken] = useState(() => authStorage.getToken());
  const [isInitializing, setIsInitializing] = useState(true);
  const [isFadingOut, setIsFadingOut] = useState(false);

  // Clear all session storage & local state
  const logout = useCallback(async () => {
    try {
      const savedToken = authStorage.getToken();
      if (savedToken) {
        await fetch(`${API_URL}/api/auth/logout`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${savedToken}`
          }
        }).catch(() => {});
      }
    } catch (e) {
      console.error('Logout error:', e);
    } finally {
      authStorage.clear();
      setToken(null);
      setCurrentUser(null);
    }
  }, []);

  // Update user & token on login/register
  const login = useCallback((userData, tokenData) => {
    if (tokenData) {
      authStorage.setToken(tokenData);
      setToken(tokenData);
    }
    if (userData) {
      authStorage.setUser(userData);
      setCurrentUser(userData);
    }
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
