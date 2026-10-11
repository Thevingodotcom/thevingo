import { describe, it, expect, beforeEach, vi } from 'vitest';
import authStorage, { purgeLegacyPersistentAuth } from './authStorage';

describe('authStorage session authentication management', () => {
  beforeEach(() => {
    sessionStorage.clear();
    localStorage.clear();
  });

  it('stores and retrieves token in sessionStorage only, never in localStorage', () => {
    authStorage.setToken('test-session-jwt');

    expect(authStorage.getToken()).toBe('test-session-jwt');
    expect(sessionStorage.getItem('token')).toBe('test-session-jwt');
    expect(localStorage.getItem('token')).toBeNull();
  });

  it('stores and retrieves user in sessionStorage only, never in localStorage', () => {
    const mockUser = { id: 42, username: 'session-user', email: 'session@vingo.com' };
    authStorage.setUser(mockUser);

    expect(authStorage.getUser()).toEqual(mockUser);
    expect(JSON.parse(sessionStorage.getItem('user'))).toEqual(mockUser);
    expect(localStorage.getItem('user')).toBeNull();
  });

  it('purges legacy persistent tokens from localStorage whenever setToken or setUser is called', () => {
    localStorage.setItem('token', 'lingering-legacy-token');
    localStorage.setItem('user', JSON.stringify({ id: 1, name: 'old-user' }));

    authStorage.setToken('new-active-token');

    expect(localStorage.getItem('token')).toBeNull();
    expect(localStorage.getItem('user')).toBeNull();
    expect(authStorage.getToken()).toBe('new-active-token');
  });

  it('purgeLegacyPersistentAuth removes any persistent auth tokens from localStorage', () => {
    localStorage.setItem('token', 'old-token');
    localStorage.setItem('user', 'old-user');

    purgeLegacyPersistentAuth();

    expect(localStorage.getItem('token')).toBeNull();
    expect(localStorage.getItem('user')).toBeNull();
  });

  it('clear() wipes out both sessionStorage and localStorage auth entries', () => {
    authStorage.setToken('active-token');
    authStorage.setUser({ id: 10 });
    sessionStorage.setItem('vingo_session_launched', 'true');
    localStorage.setItem('token', 'accidental-token');

    authStorage.clear();

    expect(authStorage.getToken()).toBeNull();
    expect(authStorage.getUser()).toBeNull();
    expect(sessionStorage.getItem('token')).toBeNull();
    expect(sessionStorage.getItem('user')).toBeNull();
    expect(sessionStorage.getItem('vingo_session_launched')).toBeNull();
    expect(localStorage.getItem('token')).toBeNull();
    expect(localStorage.getItem('user')).toBeNull();
  });

  it('simulates starting a new browsing session (empty sessionStorage) requiring re-login', () => {
    // In a brand new tab or after closing the tab, sessionStorage is completely empty
    expect(authStorage.getToken()).toBeNull();
    expect(authStorage.getUser()).toBeNull();
  });
});
