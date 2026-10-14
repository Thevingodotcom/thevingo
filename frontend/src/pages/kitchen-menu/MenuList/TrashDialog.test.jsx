import React from 'react';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import TrashDialog from './TrashDialog';

const DAY = 24 * 60 * 60 * 1000;
const iso = (ms) => new Date(ms).toISOString();
const trashed = (id, name, daysAgo, extra = {}) => {
  const trashedAt = Date.now() - daysAgo * DAY - 60 * 60 * 1000;
  return {
    id, name, price: 120 + id, image: null, isVeg: true,
    categoryId: 1, categoryName: 'Starters', categoryDeleted: false,
    trashedAt: iso(trashedAt), expiresAt: iso(trashedAt + 30 * DAY),
    ...extra
  };
};

const json = (body, status = 200) => Promise.resolve({ ok: status >= 200 && status < 300, status, json: async () => body });

const trashBody = (dishes) => ({ success: true, available: true, enabled: true, retentionDays: 30, dishes });

// Route by method + path; each handler may be a function(init) or a body.
const mockApi = (routes) => {
  global.fetch = vi.fn((url, init = {}) => {
    const key = `${init.method || 'GET'} ${new URL(url).pathname}`;
    const handler = routes[key];
    if (!handler) return json({ success: false, message: `Unexpected ${key}` }, 404);
    return typeof handler === 'function' ? handler(init) : json(handler);
  });
  return global.fetch;
};

const callsTo = (method, path) => global.fetch.mock.calls.filter(([url, init = {}]) => (init.method || 'GET') === method && new URL(url).pathname === path);

const dishes = () => [
  trashed(1, 'Paneer Tikka', 3),
  trashed(2, 'Gobi Manchurian', 0, { categoryName: 'Chinese', categoryDeleted: true, isVeg: false }),
  trashed(3, 'Lime Soda', 12, { categoryName: 'Drinks' })
];

const renderTrash = (props = {}) => {
  const onClose = vi.fn();
  const onChanged = vi.fn();
  render(<TrashDialog onClose={onClose} onChanged={onChanged} backupEnabled retentionDays={30} {...props} />);
  return { onClose, onChanged };
};

describe('TrashDialog', () => {
  beforeEach(() => {
    sessionStorage.setItem('token', 'test-token');
  });

  it('lists trashed dishes with category, restore hint, price and timing', async () => {
    mockApi({ 'GET /api/menu/trash': trashBody(dishes()) });
    renderTrash();

    expect(screen.getByRole('dialog', { name: 'Trash' })).toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent('Loading Trash…');

    const list = await screen.findByRole('list', { name: 'Dishes in Trash' });
    const rows = within(list).getAllByRole('listitem');
    expect(rows).toHaveLength(3);

    expect(rows[0]).toHaveTextContent('Paneer Tikka');
    expect(rows[0]).toHaveTextContent('Starters');
    expect(rows[0]).toHaveTextContent('121 Rs');
    expect(rows[0]).toHaveTextContent('Deleted 3 days ago · removed in 27 days');
    expect(rows[0]).not.toHaveTextContent('will be restored');

    expect(rows[1]).toHaveTextContent('Chinese');
    expect(rows[1]).toHaveTextContent('Category deleted, will be restored');
    expect(rows[1]).toHaveTextContent('Deleted today · removed in 30 days');

    expect(rows[2]).toHaveTextContent('Deleted 12 days ago · removed in 18 days');
    expect(screen.getByText(/stay here for 30 days/)).toBeInTheDocument();

    const [, init] = callsTo('GET', '/api/menu/trash')[0];
    expect(init.headers).toMatchObject({ Authorization: 'Bearer test-token' });
  });

  it('selects all / individual rows and restores them, then reports the change', async () => {
    mockApi({
      'GET /api/menu/trash': trashBody(dishes()),
      'POST /api/menu/trash/restore': { success: true, restored: 2, restoredCategories: 1, message: 'Restored' }
    });
    const { onChanged } = renderTrash();
    await screen.findByRole('list', { name: 'Dishes in Trash' });

    const restoreBtn = screen.getByRole('button', { name: 'Restore' });
    expect(restoreBtn).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Delete forever' })).toBeDisabled();

    const selectAll = screen.getByRole('checkbox', { name: 'Select all dishes in Trash' });
    fireEvent.click(selectAll);
    expect(screen.getByText('3 of 3 selected')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('checkbox', { name: 'Select Lime Soda' }));
    expect(selectAll).not.toBeChecked();
    expect(selectAll.indeterminate).toBe(true);
    expect(screen.getByText('2 of 3 selected')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Restore (2)' }));

    await waitFor(() => expect(onChanged).toHaveBeenCalledWith(expect.objectContaining({ type: 'restore', restored: 2, restoredCategories: 1 })));
    const [, init] = callsTo('POST', '/api/menu/trash/restore')[0];
    expect(JSON.parse(init.body)).toEqual({ dishIds: [1, 2] });
    expect(init.headers).toMatchObject({ 'Content-Type': 'application/json', Authorization: 'Bearer test-token' });

    expect(screen.getByRole('status')).toHaveTextContent('Restored 2 dishes and 1 category to your menu.');
    const rows = within(screen.getByRole('list', { name: 'Dishes in Trash' })).getAllByRole('listitem');
    expect(rows).toHaveLength(1);
    expect(rows[0]).toHaveTextContent('Lime Soda');
  });

  it('asks before deleting forever; Cancel sends nothing, confirm deletes the selection', async () => {
    mockApi({
      'GET /api/menu/trash': trashBody(dishes()),
      'POST /api/menu/trash/delete': { success: true, deleted: 1 }
    });
    const { onChanged } = renderTrash();
    await screen.findByRole('list', { name: 'Dishes in Trash' });

    fireEvent.click(screen.getByRole('checkbox', { name: 'Select Paneer Tikka' }));
    fireEvent.click(screen.getByRole('button', { name: 'Delete forever' }));

    let confirm = screen.getByRole('alertdialog', { name: 'Delete forever?' });
    expect(confirm).toHaveTextContent("The 1 selected dish will be permanently deleted, along with its photo. This can't be undone.");
    fireEvent.click(within(confirm).getByRole('button', { name: 'Cancel' }));
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
    expect(callsTo('POST', '/api/menu/trash/delete')).toHaveLength(0);

    fireEvent.click(screen.getByRole('button', { name: 'Delete forever' }));
    confirm = screen.getByRole('alertdialog', { name: 'Delete forever?' });
    fireEvent.click(within(confirm).getByRole('button', { name: 'Delete forever' }));

    await waitFor(() => expect(onChanged).toHaveBeenCalledWith(expect.objectContaining({ type: 'delete', deleted: 1 })));
    expect(JSON.parse(callsTo('POST', '/api/menu/trash/delete')[0][1].body)).toEqual({ dishIds: [1] });
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
    expect(screen.queryByText('Paneer Tikka')).not.toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent('Permanently deleted 1 dish.');
  });

  it('asks before emptying Trash, then shows the empty state', async () => {
    mockApi({
      'GET /api/menu/trash': trashBody(dishes()),
      'DELETE /api/menu/trash': { success: true, deleted: 3 }
    });
    const { onChanged } = renderTrash();
    await screen.findByRole('list', { name: 'Dishes in Trash' });

    fireEvent.click(screen.getByRole('button', { name: 'Empty Trash' }));
    const confirm = screen.getByRole('alertdialog', { name: 'Empty Trash?' });
    expect(confirm).toHaveTextContent("All 3 dishes in Trash will be permanently deleted, along with their photos. This can't be undone.");
    // Escape closes only the confirmation
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
    expect(screen.getByRole('dialog', { name: 'Trash' })).toBeInTheDocument();
    expect(callsTo('DELETE', '/api/menu/trash')).toHaveLength(0);

    fireEvent.click(screen.getByRole('button', { name: 'Empty Trash' }));
    fireEvent.click(within(screen.getByRole('alertdialog')).getByRole('button', { name: 'Empty Trash' }));

    await waitFor(() => expect(onChanged).toHaveBeenCalledWith(expect.objectContaining({ type: 'empty', deleted: 3 })));
    expect(screen.getByText('Trash is empty')).toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent('Trash emptied. 3 dishes were permanently deleted.');
    expect(screen.queryByRole('button', { name: 'Empty Trash' })).not.toBeInTheDocument();
  });

  it('shows an empty state that depends on the setting', async () => {
    mockApi({ 'GET /api/menu/trash': trashBody([]) });
    renderTrash();
    expect(await screen.findByText('Trash is empty')).toBeInTheDocument();
    expect(screen.getByText(/Dishes you delete will appear here for 30 days/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Restore' })).not.toBeInTheDocument();
  });

  it('explains that deletes are permanent in the empty state when backup is off', async () => {
    mockApi({ 'GET /api/menu/trash': { ...trashBody([]), enabled: false } });
    renderTrash({ backupEnabled: false });
    expect(await screen.findByText(/Dish backup is off/)).toBeInTheDocument();
  });

  it('shows a load error with a retry', async () => {
    mockApi({ 'GET /api/menu/trash': () => json({ success: false, message: 'Database unavailable' }, 500) });
    renderTrash();

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent("Couldn't load Trash");
    expect(alert).toHaveTextContent('Database unavailable');

    mockApi({ 'GET /api/menu/trash': trashBody(dishes()) });
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
    expect(await screen.findByRole('list', { name: 'Dishes in Trash' })).toBeInTheDocument();
  });

  it('keeps the rows and shows the server message when restoring fails', async () => {
    mockApi({
      'GET /api/menu/trash': trashBody(dishes()),
      'POST /api/menu/trash/restore': () => json({ message: 'Dish backup is not available yet.' }, 409)
    });
    const { onChanged } = renderTrash();
    await screen.findByRole('list', { name: 'Dishes in Trash' });

    fireEvent.click(screen.getByRole('checkbox', { name: 'Select Paneer Tikka' }));
    fireEvent.click(screen.getByRole('button', { name: 'Restore (1)' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Dish backup is not available yet.');
    expect(screen.getAllByRole('listitem')).toHaveLength(3);
    expect(onChanged).not.toHaveBeenCalled();
  });

  it('closes with the close button and with Escape', async () => {
    mockApi({ 'GET /api/menu/trash': trashBody([]) });
    const { onClose } = renderTrash();
    await screen.findByText('Trash is empty');

    fireEvent.click(screen.getByRole('button', { name: 'Close Trash' }));
    expect(onClose).toHaveBeenCalledTimes(1);
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(2);
  });
});
