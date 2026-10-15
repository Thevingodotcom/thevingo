import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import App from './App';
import { AuthProvider } from './app/AuthContext';
import { ThemeProvider } from './app/ThemeContext';

// Mock child pages or subcomponents if needed to prevent rendering errors
vi.mock('./pages/landingpage/LandingPage', () => ({
  default: () => <div>Landing Page Mocked</div>
}));

const renderApp = () => render(
  <BrowserRouter>
    <ThemeProvider>
      <AuthProvider>
        <App />
      </AuthProvider>
    </ThemeProvider>
  </BrowserRouter>
);

describe('App Component Routing', () => {
  it('renders landing page by default', () => {
    renderApp();

    // Verify default path '/' renders Landing Page
    expect(screen.getByText('Landing Page Mocked')).toBeInTheDocument();
  });
});

describe('Dashboard session flow', () => {
  const user = { id: 7, username: 'Asha Kumar', email: 'asha@example.com', role: 'Admin', restaurant_name: 'Asha Cafe', avatar: null };

  const jsonResponse = (body, ok = true) => Promise.resolve({ ok, status: ok ? 200 : 500, json: () => Promise.resolve(body) });

  beforeEach(() => {
    sessionStorage.clear();
    sessionStorage.setItem('token', 'test-token');
    sessionStorage.setItem('user', JSON.stringify(user));
    sessionStorage.setItem('vingo_session_launched', 'true');
    window.matchMedia = window.matchMedia || (() => ({ matches: false, addListener: () => {}, removeListener: () => {} }));

    global.fetch = vi.fn((url) => {
      if (url.includes('/api/menu/categories')) {
        return jsonResponse({ categories: [{ id: '1', name: 'Starters', items: [{ id: 'a' }, { id: 'b' }] }, { id: '2', name: 'Mains', items: [{ id: 'c' }] }] });
      }
      if (url.includes('/api/offers')) {
        // Shape returned by offerController.getOffers
        return jsonResponse({ offers: [
          { id: '1', name: 'Combo', status: 'Active', isActive: true },
          { id: '2', name: 'Old', status: 'Inactive', isActive: false }
        ] });
      }
      if (url.includes('/api/auth/dashboard')) {
        return jsonResponse({ stats: { scanCount: 42 } });
      }
      if (url.includes('/api/auth/logout')) {
        return jsonResponse({ success: true });
      }
      return jsonResponse({}, false);
    });
  });

  afterEach(() => {
    sessionStorage.clear();
    localStorage.removeItem('thevingo_theme');
    window.history.replaceState({}, '', '/');
  });

  const statCard = (label) => screen.getByRole('button', { name: new RegExp(`^${label}:`) });

  it('shows the counts, only the user name (no role) and logs out to the home page without a dead /dashboard entry', async () => {
    window.history.replaceState({}, '', '/');
    window.history.pushState({}, '', '/dashboard');
    const lengthBefore = window.history.length;

    renderApp();

    // Bootstrap splash takes ~1.1s
    await waitFor(() => expect(statCard('Dish')).toHaveTextContent('3'), { timeout: 4000 });
    expect(statCard('Category')).toHaveTextContent('2');
    expect(statCard('Active offer')).toHaveTextContent('1');
    expect(statCard('Total Scan')).toHaveTextContent('42');

    // Name only beside the avatar, no role line, no hardcoded fallback name
    expect(screen.getByText('Asha Kumar')).toBeInTheDocument();
    expect(screen.queryByText('Admin')).not.toBeInTheDocument();
    expect(screen.queryByText('Krishna Ram')).not.toBeInTheDocument();
    expect(screen.getByText('AK')).toBeInTheDocument();

    // Stat cards navigate to the page that manages them
    fireEvent.click(statCard('Active offer'));
    await waitFor(() => expect(window.location.pathname).toBe('/dashboard/offers'));
    const lengthOnOffers = window.history.length;
    expect(lengthOnOffers).toBe(lengthBefore + 1);

    // Logout lives only in the avatar menu (no standalone navbar button)
    expect(screen.queryByRole('button', { name: 'Logout' })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /account menu for asha kumar/i }));
    // Logout from the avatar menu -> home page, replacing the current entry
    fireEvent.click(screen.getByRole('menuitem', { name: 'Logout' }));
    await waitFor(() => expect(screen.getByText('Landing Page Mocked')).toBeInTheDocument());
    expect(window.location.pathname).toBe('/');
    expect(window.history.length).toBe(lengthOnOffers);
    expect(sessionStorage.getItem('token')).toBeNull();

    // Back lands on the old /dashboard entry, which is replaced by the home page (not /login)
    await act(async () => {
      window.history.back();
      await new Promise((resolve) => setTimeout(resolve, 50));
    });
    await waitFor(() => expect(window.location.pathname).toBe('/'));
    expect(screen.getByText('Landing Page Mocked')).toBeInTheDocument();
  });

  it('toggles dark mode from the avatar menu, scoped to the dashboard shell only', async () => {
    localStorage.removeItem('thevingo_theme');
    window.history.replaceState({}, '', '/dashboard');

    renderApp();

    const trigger = await screen.findByRole('button', { name: /account menu for asha kumar/i }, { timeout: 4000 });
    const appContainer = document.querySelector('.app-container');
    expect(appContainer).toHaveAttribute('data-theme', 'light');

    fireEvent.click(trigger);
    const toggle = screen.getByRole('switch', { name: /dark mode/i });
    fireEvent.click(toggle);

    expect(appContainer).toHaveAttribute('data-theme', 'dark');
    expect(localStorage.getItem('thevingo_theme')).toBe('dark');
    // The document root is never flipped to dark by this toggle: public/auth
    // pages must stay light-only (an unrelated bootstrap step sets <html>'s
    // own data-theme to a hardcoded 'light', separately from this feature).
    expect(document.documentElement.getAttribute('data-theme')).not.toBe('dark');
  });

  it('logs out from the avatar menu to the home page', async () => {
    window.history.replaceState({}, '', '/dashboard');

    renderApp();

    const trigger = await screen.findByRole('button', { name: /account menu for asha kumar/i }, { timeout: 4000 });
    fireEvent.click(trigger);
    fireEvent.click(screen.getByRole('menuitem', { name: 'Logout' }));

    await waitFor(() => expect(screen.getByText('Landing Page Mocked')).toBeInTheDocument());
    expect(window.location.pathname).toBe('/');
  });

  it('redirects a logged-out visit to /dashboard to /login with replace', async () => {
    sessionStorage.clear();
    window.history.replaceState({}, '', '/');
    window.history.pushState({}, '', '/dashboard');
    const lengthBefore = window.history.length;

    renderApp();

    await waitFor(() => expect(window.location.pathname).toBe('/login'), { timeout: 4000 });
    expect(window.history.length).toBe(lengthBefore);
  });
});
