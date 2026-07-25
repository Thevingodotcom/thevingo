import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { API_URL } from '../config';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [currentUser, setCurrentUser] = useState(() => {
    try {
      const saved = localStorage.getItem('user');
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });

  const [token, setToken] = useState(() => localStorage.getItem('token') || null);
  const [isInitializing, setIsInitializing] = useState(true);
  const [isFadingOut, setIsFadingOut] = useState(false);

  // Clear all session storage & local state
  const logout = useCallback(async () => {
    try {
      const savedToken = localStorage.getItem('token');
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
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      setToken(null);
      setCurrentUser(null);
    }
  }, []);

  // Update user & token on login/register
  const login = useCallback((userData, tokenData) => {
    if (tokenData) {
      localStorage.setItem('token', tokenData);
      setToken(tokenData);
    }
    if (userData) {
      localStorage.setItem('user', JSON.stringify(userData));
      setCurrentUser(userData);
    }
  }, []);

  // Session validation helper
  const validateSession = useCallback(async () => {
    const savedToken = localStorage.getItem('token');
    if (!savedToken) {
      localStorage.removeItem('user');
      setToken(null);
      setCurrentUser(null);
      return false;
    }

    // Check offline status
    if (!navigator.onLine) {
      const savedUser = localStorage.getItem('user');
      if (savedUser) {
        try {
          setCurrentUser(JSON.parse(savedUser));
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
        const savedUser = localStorage.getItem('user');
        if (savedUser) {
          setCurrentUser(JSON.parse(savedUser));
        }
        setToken(savedToken);
        return true;
      } else if (res.status === 401 || res.status === 403) {
        // Token expired or invalid
        localStorage.removeItem('token');
        localStorage.removeItem('user');
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
