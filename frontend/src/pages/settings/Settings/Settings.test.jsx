import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AuthProvider } from '../../../app/AuthContext';
import { ThemeProvider } from '../../../app/ThemeContext';
import { downloadMenu } from '../../../utils/menuExport';
import Settings from './Settings';

vi.mock('../../../utils/menuExport', async (importOriginal) => ({
  ...(await importOriginal()),
  downloadMenu: vi.fn()
}));

const categories = [
  { id: 1, name: 'Starters', items: [{ id: 11, name: 'Paneer Tikka', price: 129, isVeg: true }] }
];

const renderSettings = (props = {}) => render(
  <ThemeProvider>
    <AuthProvider>
      <Settings
        categories={categories}
        currentUser={{ id: 1, username: 'Ravi' }}
        restaurantName="Sri Annapoorna"
        tagline="Since 1975"
        hotelAddress="12 Race Course Road"
        hotelCity="Coimbatore"
        hotelState=""
        {...props}
      />
    </AuthProvider>
  </ThemeProvider>
);

describe('Settings menu download', () => {
  beforeEach(() => {
    vi.mocked(downloadMenu).mockReset();
    // The Dish backup card loads its status on mount; never hit the network.
    global.fetch = vi.fn(async () => ({
      ok: true,
      status: 200,
      json: async () => ({ success: true, available: false, enabled: false, retentionDays: 30, trashCount: 0 })
    }));
  });

  it('offers Excel, PDF and Image downloads of the menu', async () => {
    let finish;
    vi.mocked(downloadMenu).mockImplementation(() => new Promise(resolve => { finish = resolve; }));
    renderSettings();

    fireEvent.click(screen.getByRole('button', { name: 'PDF' }));

    expect(downloadMenu).toHaveBeenCalledWith('pdf', {
      categories,
      restaurantName: 'Sri Annapoorna',
      tagline: 'Since 1975',
      address: '12 Race Course Road, Coimbatore'
    });
    expect(screen.getByRole('button', { name: 'Preparing…' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Excel' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Image' })).toBeDisabled();

    finish();
    await waitFor(() => expect(screen.getByRole('button', { name: 'PDF' })).toBeEnabled());
  });

  it('shows an error when the download fails', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.mocked(downloadMenu).mockRejectedValue(new Error('boom'));
    renderSettings();

    fireEvent.click(screen.getByRole('button', { name: 'Excel' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(/Could not prepare the download/);
  });

  it('disables the downloads when the menu has no dishes', () => {
    renderSettings({ categories: [{ id: 1, name: 'Starters', items: [] }] });

    ['Excel', 'PDF', 'Image'].forEach(name => {
      expect(screen.getByRole('button', { name })).toBeDisabled();
    });
    expect(screen.getByText(/Add dishes to your menu to download it/)).toBeInTheDocument();
  });
});
