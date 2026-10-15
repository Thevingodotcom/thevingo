import { useContext } from 'react';
import AuthContext from '../../app/AuthContext';
import authStorage from '../../app/authStorage';

/**
 * Whether the visitor has an active session, for the public marketing pages.
 * Reads the auth context (same source as useAuth) but, unlike useAuth, does not
 * throw when rendered outside an AuthProvider (e.g. isolated component tests).
 * Falls back to stored token because Login/Register persist the token to storage
 * before the context token is updated — same check RouteGuard uses.
 */
const useIsLoggedIn = () => {
  const auth = useContext(AuthContext);
  return Boolean(auth?.token || authStorage.getToken());
};

export default useIsLoggedIn;
