import React from 'react';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import MenuList from './MenuList';

// Dish backup / Trash integration in the kitchen menu. Uses the real
// useDishBackup hook with a URL-routed fetch mock (no network).

const json = (body, status = 200) => Promise.resolve({ ok: status >= 200 && status < 300, status, json: async () => body });

const BACKUP = {
  on: { success: true, available: true, enabled: true, retentionDays: 30, trashCount: 5 },
  off: { success: true, available: true, enabled: false, retentionDays: 30, trashCount: 2 },
  unavailable: { success: true, available: false, enabled: false, retentionDays: 30, trashCount: 0 }
};

const DAY = 24 * 60 * 60 * 1000;
const trashedDish = {
  id: 7, name: 'Masala Dosa', price: 90, image: null, isVeg: true,
  categoryId: 3, categoryName: 'Tiffin', categoryDeleted: true,
  trashedAt: new Date(Date.now() - 2 * DAY).toISOString(),
  expiresAt: new Date(Date.now() + 28 * DAY).toISOString()
};

let backupResponses;
const mockApi = (mode, extra = {}) => {
  backupResponses = [BACKUP[mode]];
  global.fetch = vi.fn((url, init = {}) => {
    const key = `${init.method || 'GET'} ${new URL(url).pathname}`;
    if (key === 'GET /api/menu/backup') {
      return json(backupResponses.length > 1 ? backupResponses.shift() : backupResponses[0]);
    }
    if (extra[key]) return json(extra[key]);
    if (key.startsWith('DELETE /api/menu/categories/') || key === 'DELETE /api/menu/all' || key === 'POST /api/menu/dishes/delete-batch') {
      return json({ success: true });
    }
    return json({ success: false, message: `Unexpected ${key}` }, 404);
  });
};

const backupCalls = () => global.fetch.mock.calls.filter(([url, init = {}]) => (init.method || 'GET') === 'GET' && url.endsWith('/api/menu/backup'));

const menu = () => [
  {
    id: '1',
    name: 'Biriyani',
    items: [
      { id: '101', name: 'Chicken Biriyani', price: 280, isVeg: false, availableLunch: true, availableDinner: true },
      { id: '102', name: 'Veg Biriyani', price: 200, isVeg: true, availableLunch: true, availableDinner: true }
    ]
  }
];

const renderMenu = (props = {}) => render(<MenuList categories={menu()} setCategories={vi.fn()} {...props} />);
const waitForBackupLoaded = () => waitFor(() => expect(backupCalls().length).toBeGreaterThan(0));

const openCategoryDelete = () => {
  const optionsBtn = screen.getByText('Biriyani', { selector: 'h3' }).parentElement.querySelector('.category-options-btn');
  fireEvent.click(optionsBtn);
  fireEvent.click(screen.getByRole('button', { name: /Delete category/i }));
  return screen.getByRole('alertdialog');
};

const openDeleteAll = () => {
  fireEvent.click(screen.getByTitle('Add Action'));
  fireEvent.click(screen.getByRole('button', { name: /Delete all/i }));
  return screen.getByRole('alertdialog');
};

const openDishDelete = () => {
  const optionsBtn = screen.getByText('Biriyani', { selector: 'h3' }).parentElement.querySelector('.category-options-btn');
  fireEvent.click(optionsBtn);
  fireEvent.click(screen.getByRole('button', { name: 'Delete dishes' }));
  fireEvent.click(screen.getByText('Chicken Biriyani').closest('article'));
  fireEvent.click(screen.getByText('Veg Biriyani').closest('article'));
  fireEvent.click(screen.getByTitle('Delete Selected Dishes'));
  return screen.getByRole('alertdialog');
};

describe('MenuList dish backup / Trash', () => {
  beforeEach(() => {
    sessionStorage.setItem('token', 'test-token');
  });

  it('loads the backup status on mount', async () => {
    mockApi('on');
    renderMenu();
    await waitForBackupLoaded();
    const [url, init] = backupCalls()[0];
    expect(url).toMatch(/\/api\/menu\/backup$/);
    expect(init.headers).toMatchObject({ Authorization: 'Bearer test-token' });
  });

  describe('Trash entry', () => {
    it('is hidden when the feature is unavailable', async () => {
      mockApi('unavailable');
      renderMenu();
      await waitForBackupLoaded();
      await new Promise(resolve => setTimeout(resolve, 0));

      fireEvent.click(screen.getByTitle('Add Action'));
      expect(screen.queryByRole('button', { name: /Trash/ })).not.toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Delete all/i })).toBeInTheDocument();
    });

    it('is hidden while the status failed to load', async () => {
      global.fetch = vi.fn(() => json({ success: false }, 500));
      renderMenu();
      await waitFor(() => expect(global.fetch).toHaveBeenCalled());
      fireEvent.click(screen.getByTitle('Add Action'));
      expect(screen.queryByRole('button', { name: /Trash/ })).not.toBeInTheDocument();
    });

    it('shows the count in the toolbar and in the FAB menu (also when backup is off)', async () => {
      mockApi('off');
      renderMenu();

      expect(await screen.findByRole('button', { name: 'Open Trash (2 dishes)' })).toBeInTheDocument();
      fireEvent.click(screen.getByTitle('Add Action'));
      const fabOption = screen.getByRole('button', { name: 'Trash (2 dishes)' });
      expect(fabOption).toHaveTextContent('Trash (2)');
    });

    it('is offered on an empty menu so deleted dishes can be restored', async () => {
      mockApi('on');
      render(<MenuList categories={[]} setCategories={vi.fn()} />);
      expect(await screen.findByRole('button', { name: 'Restore deleted dishes from Trash (5)' })).toBeInTheDocument();
      fireEvent.click(screen.getByTitle('Add Action'));
      expect(screen.getByRole('button', { name: 'Trash (5 dishes)' })).toBeInTheDocument();
    });

    it('opens Trash from the FAB and refreshes the menu after a restore', async () => {
      mockApi('on', {
        'GET /api/menu/trash': { success: true, available: true, enabled: true, retentionDays: 30, dishes: [trashedDish] },
        'POST /api/menu/trash/restore': { success: true, restored: 1, restoredCategories: 1 }
      });
      const onMenuRefresh = vi.fn();
      renderMenu({ onMenuRefresh });
      await screen.findByRole('button', { name: 'Open Trash (5 dishes)' });

      fireEvent.click(screen.getByTitle('Add Action'));
      fireEvent.click(screen.getByRole('button', { name: 'Trash (5 dishes)' }));
      const dialog = screen.getByRole('dialog', { name: 'Trash' });
      expect(await within(dialog).findByText('Masala Dosa')).toBeInTheDocument();
      expect(within(dialog).getByText('Category deleted, will be restored')).toBeInTheDocument();

      backupResponses = [{ ...BACKUP.on, trashCount: 4 }];
      fireEvent.click(within(dialog).getByRole('checkbox', { name: 'Select Masala Dosa' }));
      fireEvent.click(within(dialog).getByRole('button', { name: 'Restore (1)' }));

      await waitFor(() => expect(onMenuRefresh).toHaveBeenCalledTimes(1));
      expect(await screen.findByRole('button', { name: 'Open Trash (4 dishes)' })).toBeInTheDocument();
      expect(within(dialog).getByText('Restored 1 dish and 1 category to your menu.')).toBeInTheDocument();

      fireEvent.click(within(dialog).getByRole('button', { name: 'Close Trash' }));
      expect(screen.queryByRole('dialog', { name: 'Trash' })).not.toBeInTheDocument();
    });

    it('opens Trash when navigated here from Settings, then clears the request', async () => {
      mockApi('on', { 'GET /api/menu/trash': { success: true, available: true, enabled: true, retentionDays: 30, dishes: [] } });
      const onTrashRequestHandled = vi.fn();
      renderMenu({ openTrashRequested: true, onTrashRequestHandled });

      expect(await screen.findByRole('dialog', { name: 'Trash' })).toBeInTheDocument();
      expect(onTrashRequestHandled).toHaveBeenCalledTimes(1);
      expect(await screen.findByText('Trash is empty')).toBeInTheDocument();
    });

    it('does not open Trash from Settings when the feature is unavailable', async () => {
      mockApi('unavailable');
      const onTrashRequestHandled = vi.fn();
      renderMenu({ openTrashRequested: true, onTrashRequestHandled });

      await waitFor(() => expect(onTrashRequestHandled).toHaveBeenCalledTimes(1));
      expect(screen.queryByRole('dialog', { name: 'Trash' })).not.toBeInTheDocument();
    });
  });

  describe('delete confirmation wording', () => {
    const settle = async (mode) => {
      mockApi(mode);
      renderMenu();
      await waitForBackupLoaded();
      if (mode !== 'unavailable') {
        await screen.findByRole('button', { name: /Open Trash/ });
      } else {
        await new Promise(resolve => setTimeout(resolve, 0));
      }
    };

    it('category delete: ON moves dishes to Trash', async () => {
      await settle('on');
      const dialog = openCategoryDelete();
      expect(dialog).toHaveTextContent('The 2 dishes in this category will be moved to Trash. You can restore them for 30 days.');
      expect(dialog).not.toHaveTextContent(/permanently/);
    });

    it('category delete: OFF is permanent', async () => {
      await settle('off');
      const dialog = openCategoryDelete();
      expect(dialog).toHaveTextContent("The 2 dishes in this category will be permanently deleted. This can't be undone.");
      expect(dialog).not.toHaveTextContent(/Trash/);
    });

    it("category delete: unavailable keeps today's wording", async () => {
      await settle('unavailable');
      const dialog = openCategoryDelete();
      expect(dialog).toHaveTextContent("This will also permanently delete the 2 dishes in this category. This can't be undone.");
    });

    it('delete all: ON moves dishes to Trash', async () => {
      await settle('on');
      const dialog = openDeleteAll();
      expect(dialog).toHaveTextContent('All 1 category will be deleted and the 2 dishes will be moved to Trash. You can restore them for 30 days.');
      fireEvent.click(within(dialog).getByRole('button', { name: 'Cancel' }));
    });

    it('delete all: OFF is permanent', async () => {
      await settle('off');
      const dialog = openDeleteAll();
      expect(dialog).toHaveTextContent("All 1 category and 2 dishes will be permanently deleted, along with their uploaded photos. This can't be undone.");
      fireEvent.click(within(dialog).getByRole('button', { name: 'Cancel' }));
    });

    it("delete all: unavailable keeps today's wording", async () => {
      await settle('unavailable');
      const dialog = openDeleteAll();
      expect(dialog).toHaveTextContent("This will permanently delete all 1 category and 2 dish(es), along with their uploaded photos. This can't be undone.");
    });

    it('dish delete: ON moves the selected dishes to Trash and refreshes the count', async () => {
      await settle('on');
      const dialog = openDishDelete();
      expect(dialog).toHaveTextContent('Delete dishes?');
      expect(dialog).toHaveTextContent('The selected dishes will be moved to Trash. You can restore them for 30 days.');

      const before = backupCalls().length;
      fireEvent.click(within(dialog).getByRole('button', { name: 'Delete' }));
      await waitFor(() => expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument());
      const [, init] = global.fetch.mock.calls.find(([url]) => url.endsWith('/api/menu/dishes/delete-batch'));
      expect(JSON.parse(init.body)).toEqual({ dishIds: ['101', '102'] });
      await waitFor(() => expect(backupCalls().length).toBe(before + 1));
    });

    it('dish delete: OFF is permanent', async () => {
      await settle('off');
      const dialog = openDishDelete();
      expect(dialog).toHaveTextContent("The selected dishes will be permanently deleted. This can't be undone.");
    });

    it("dish delete: unavailable keeps today's wording and Cancel sends nothing", async () => {
      await settle('unavailable');
      const dialog = openDishDelete();
      expect(dialog).toHaveTextContent('Are you sure you want to delete the 2 selected dishes?');
      expect(dialog).not.toHaveTextContent(/Trash|permanently/);

      fireEvent.click(within(dialog).getByRole('button', { name: 'Cancel' }));
      expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
      expect(global.fetch.mock.calls.some(([url]) => url.endsWith('/api/menu/dishes/delete-batch'))).toBe(false);
    });
  });
});
