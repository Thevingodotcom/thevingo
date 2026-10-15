import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from './AuthContext';
import authStorage from './authStorage';

/**
 * ProtectedRoute ensures that:
 * 1. While auth state is initializing, no protected content is flashed.
 * 2. Unauthenticated users are redirected (history *replace*, so the dead protected
 *    entry is not kept around) to /login — or, right after an explicit logout,
 *    to the path the logout asked for (the home page), so pressing Back into
 *    /dashboard after logging out lands on home instead of bouncing to /login.
 */
export const ProtectedRoute = ({ children }) => {
  const { token, isInitializing, postLogoutPath } = useAuth();
  const location = useLocation();

  if (isInitializing) {
    // Prevent flash of protected routes while verifying session
    return null;
  }

  const savedToken = token || authStorage.getToken();

  if (!savedToken) {
    if (postLogoutPath) {
      return <Navigate to={postLogoutPath} replace />;
    }
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  return children;
};

/**
 * PublicRoute ensures that:
 * 1. While auth state is initializing, no screen flickers occur.
 * 2. Authenticated users attempting to visit login/register are redirected
 *    (history *replace*) to /dashboard.
 */
export const PublicRoute = ({ children }) => {
  const { token, isInitializing } = useAuth();

  if (isInitializing) {
    return null;
  }

  const savedToken = token || authStorage.getToken();

  if (savedToken) {
    return <Navigate to="/dashboard" replace />;
  }

  return children;
};

export default ProtectedRoute;
