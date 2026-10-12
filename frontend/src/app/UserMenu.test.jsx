import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AuthProvider, useAuth } from './AuthContext';
import { ThemeProvider } from './ThemeContext';
import UserMenu from './UserMenu';
import authStorage from './authStorage';

const ConnectedMenu = ({ onLogout = () => {} }) => {
  const { currentUser } = useAuth();
  return <UserMenu currentUser={currentUser} onLogout={onLogout} />;
};

const renderMenu = (props) => render(
  <ThemeProvider>
    <AuthProvider>
      <ConnectedMenu {...props} />
    </AuthProvider>
  </ThemeProvider>
);

const pngFile = (size = 10) => new File([new Uint8Array(size)], 'me.png', { type: 'image/png' });

describe('UserMenu (navbar avatar)', () => {
  beforeEach(() => {
    sessionStorage.clear();
    authStorage.setToken('tok');
    authStorage.setUser({ id: 3, username: 'Ravi', role: 'user', avatar: null });
    global.fetch = vi.fn();
  });

  it('shows only the name and initials, and opens a menu without "Remove photo" when no photo is set', () => {
    renderMenu();
    expect(screen.getByText('Ravi')).toBeInTheDocument();
    expect(screen.queryByText('user')).not.toBeInTheDocument();
    expect(screen.getByText('RA')).toBeInTheDocument();

    const trigger = screen.getByRole('button', { name: /account menu for ravi/i });
    expect(trigger).toHaveAttribute('aria-expanded', 'false');
    // Chevron inside the trigger signals the dropdown (Logout lives only here)
    expect(trigger).toContainElement(screen.getByTestId('user-menu-chevron'));
    fireEvent.click(trigger);
    expect(trigger).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByRole('menuitem', { name: 'Upload photo' })).toBeInTheDocument();
    expect(screen.queryByRole('menuitem', { name: 'Remove photo' })).not.toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: 'Logout' })).toBeInTheDocument();

    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
  });

  it('uploads a photo, shows it and persists it to authStorage', async () => {
    global.fetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ success: true, user: { id: 3, username: 'Ravi', avatar: '/uploads/avatar-3-1.png' } })
    });
    const { container } = renderMenu();

    fireEvent.change(screen.getByTestId('navbar-avatar-input'), { target: { files: [pngFile()] } });

    await waitFor(() => expect(container.querySelector('img.user-avatar__img')).not.toBeNull());
    expect(container.querySelector('img.user-avatar__img').getAttribute('src')).toMatch(/\/uploads\/avatar-3-1\.png$/);
    expect(authStorage.getUser().avatar).toBe('/uploads/avatar-3-1.png');
    expect(authStorage.getUser().role).toBe('user');

    const [url, options] = global.fetch.mock.calls[0];
    expect(url).toMatch(/\/api\/auth\/avatar$/);
    expect(options.method).toBe('PUT');
    expect(options.headers.Authorization).toBe('Bearer tok');
    expect(options.body.get('avatar')).toBeInstanceOf(File);

    // Remove is now offered
    fireEvent.click(screen.getByRole('button', { name: /account menu/i }));
    expect(screen.getByRole('menuitem', { name: 'Remove photo' })).toBeInTheDocument();
  });

  it('rejects files over 2MB without calling the API', () => {
    renderMenu();
    fireEvent.change(screen.getByTestId('navbar-avatar-input'), { target: { files: [pngFile(2 * 1024 * 1024 + 1)] } });
    expect(screen.getByRole('alert')).toHaveTextContent('2MB');
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('removes the photo and falls back to initials', async () => {
    authStorage.setUser({ id: 3, username: 'Ravi', avatar: '/uploads/avatar-3-1.png' });
    global.fetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ success: true, user: { id: 3, username: 'Ravi', avatar: null } })
    });
    const { container } = renderMenu();
    expect(container.querySelector('img.user-avatar__img')).not.toBeNull();

    fireEvent.click(screen.getByRole('button', { name: /account menu/i }));
    fireEvent.click(screen.getByRole('menuitem', { name: 'Remove photo' }));

    await waitFor(() => expect(screen.getByText('RA')).toBeInTheDocument());
    expect(global.fetch.mock.calls[0][1].method).toBe('DELETE');
    expect(authStorage.getUser().avatar).toBeNull();
  });

  it('calls onLogout from the menu', () => {
    const onLogout = vi.fn();
    renderMenu({ onLogout });
    // Logout is only reachable through the menu, never as a standalone button
    expect(screen.queryByRole('menuitem', { name: 'Logout' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Logout' })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /account menu/i }));
    fireEvent.click(screen.getByRole('menuitem', { name: 'Logout' }));
    expect(onLogout).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
  });

  it('falls back to "User" when there is no user name', () => {
    const Wrapper = ({ children }) => (
      <ThemeProvider>
        <AuthProvider>{children}</AuthProvider>
      </ThemeProvider>
    );
    render(<UserMenu currentUser={null} onLogout={() => {}} />, { wrapper: Wrapper });
    expect(screen.getByText('User')).toBeInTheDocument();
  });

  it('exposes a dark mode toggle in sync with ThemeContext, persisted to localStorage', () => {
    localStorage.removeItem('thevingo_theme');
    renderMenu();

    fireEvent.click(screen.getByRole('button', { name: /account menu/i }));
    const toggle = screen.getByRole('switch', { name: /dark mode/i });
    expect(toggle).not.toBeChecked();

    fireEvent.click(toggle);
    expect(toggle).toBeChecked();
    expect(localStorage.getItem('thevingo_theme')).toBe('dark');

    fireEvent.click(toggle);
    expect(toggle).not.toBeChecked();
    expect(localStorage.getItem('thevingo_theme')).toBe('light');
  });
});
