import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from './AuthContext';

/**
 * ProtectedRoute ensures that:
 * 1. While auth state is initializing, no protected content is flashed.
 * 2. Unauthenticated users are strictly redirected to /login.
 */
export const ProtectedRoute = ({ children }) => {
  const { token, currentUser, isInitializing } = useAuth();
  const location = useLocation();

  if (isInitializing) {
    // Prevent flash of protected routes while verifying session
    return null;
  }

  const savedToken = token || localStorage.getItem('token');

  if (!savedToken) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  return children;
};

/**
 * PublicRoute ensures that:
 * 1. While auth state is initializing, no screen flickers occur.
 * 2. Authenticated users attempting to visit login/register are redirected to /dashboard.
 */
export const PublicRoute = ({ children }) => {
  const { token, isInitializing } = useAuth();

  if (isInitializing) {
    return null;
  }

  const savedToken = token || localStorage.getItem('token');

  if (savedToken) {
    return <Navigate to="/dashboard" replace />;
  }

  return children;
};

export default ProtectedRoute;
