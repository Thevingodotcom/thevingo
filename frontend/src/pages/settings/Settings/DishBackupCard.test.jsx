import React from 'react';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import DishBackupCard, { TURN_OFF_WARNING } from './DishBackupCard';

const json = (body, status = 200) => Promise.resolve({ ok: status >= 200 && status < 300, status, json: async () => body });
const statusBody = (overrides = {}) => ({ success: true, available: true, enabled: true, retentionDays: 30, trashCount: 4, ...overrides });

// Routes GET/PUT /api/menu/backup; `putResponses` are consumed in order.
const mockBackupApi = ({ initial = statusBody(), putResponses = [] } = {}) => {
  const queue = [...putResponses];
  global.fetch = vi.fn((url, init = {}) => {
    if (url.endsWith('/api/menu/backup') && (init.method || 'GET') === 'GET') return json(initial);
    if (url.endsWith('/api/menu/backup') && init.method === 'PUT') {
      const next = queue.shift();
      if (next) return json(next.body, next.status);
      const { enabled } = JSON.parse(init.body);
      return json(statusBody({ enabled }));
    }
    return json({ success: false }, 404);
  });
  return global.fetch;
};

const putCalls = () => global.fetch.mock.calls.filter(([, init]) => init && init.method === 'PUT');

describe('Settings > Dish backup card', () => {
  beforeEach(() => {
    sessionStorage.setItem('token', 'test-token');
  });

  it('loads the setting and shows the switch ON with an Open Trash (N) action', async () => {
    mockBackupApi();
    const onOpenTrash = vi.fn();
    render(<DishBackupCard onOpenTrash={onOpenTrash} />);

    const toggle = screen.getByRole('switch', { name: /keep deleted dishes in trash/i });
    expect(toggle).toBeDisabled();

    await waitFor(() => expect(toggle).toBeEnabled());
    expect(toggle).toBeChecked();
    expect(toggle).toHaveAttribute('aria-checked', 'true');
    expect(screen.getByText(/deleted dishes go to Trash\. You can restore them for 30 days/)).toBeInTheDocument();
    expect(screen.getByText(/deleted dishes are permanently deleted and can't be recovered/)).toBeInTheDocument();

    const [url, init] = global.fetch.mock.calls[0];
    expect(url).toMatch(/\/api\/menu\/backup$/);
    expect(init.headers).toMatchObject({ Authorization: 'Bearer test-token' });

    fireEvent.click(screen.getByRole('button', { name: 'Open Trash (4)' }));
    expect(onOpenTrash).toHaveBeenCalledTimes(1);
  });

  it('asks for confirmation before turning OFF; Cancel keeps it ON', async () => {
    mockBackupApi();
    render(<DishBackupCard onOpenTrash={vi.fn()} />);
    const toggle = screen.getByRole('switch');
    await waitFor(() => expect(toggle).toBeChecked());

    fireEvent.click(toggle);
    const dialog = screen.getByRole('alertdialog', { name: 'Turn off dish backup?' });
    expect(dialog).toHaveTextContent(TURN_OFF_WARNING);
    expect(TURN_OFF_WARNING).toBe("Dishes you delete from now on will be permanently deleted and can't be recovered. Dishes already in Trash stay there until you empty Trash or they expire after 30 days.");
    expect(toggle).toBeChecked();

    fireEvent.click(within(dialog).getByRole('button', { name: 'Keep backup on' }));
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
    expect(toggle).toBeChecked();
    expect(putCalls()).toHaveLength(0);

    // Escape cancels too
    fireEvent.click(toggle);
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
    expect(putCalls()).toHaveLength(0);
  });

  it('turns OFF after confirming and saves { enabled: false }', async () => {
    mockBackupApi();
    render(<DishBackupCard onOpenTrash={vi.fn()} />);
    const toggle = screen.getByRole('switch');
    await waitFor(() => expect(toggle).toBeChecked());

    fireEvent.click(toggle);
    fireEvent.click(screen.getByRole('button', { name: 'Turn off' }));

    await waitFor(() => expect(toggle).not.toBeChecked());
    expect(toggle).toHaveAttribute('aria-checked', 'false');
    expect(putCalls()).toHaveLength(1);
    const [url, init] = putCalls()[0];
    expect(url).toMatch(/\/api\/menu\/backup$/);
    expect(JSON.parse(init.body)).toEqual({ enabled: false });
    expect(init.headers).toMatchObject({ 'Content-Type': 'application/json', Authorization: 'Bearer test-token' });
    await waitFor(() => expect(toggle).toBeEnabled());
  });

  it('turns ON immediately without a confirmation (also with the Enter key)', async () => {
    mockBackupApi({ initial: statusBody({ enabled: false, trashCount: 2 }) });
    render(<DishBackupCard onOpenTrash={vi.fn()} />);
    const toggle = screen.getByRole('switch');
    await waitFor(() => expect(toggle).toBeEnabled());
    expect(toggle).not.toBeChecked();
    expect(screen.getByRole('button', { name: 'Open Trash (2)' })).toBeInTheDocument();

    fireEvent.keyDown(toggle, { key: 'Enter' });
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
    await waitFor(() => expect(toggle).toBeChecked());
    expect(JSON.parse(putCalls()[0][1].body)).toEqual({ enabled: true });
  });

  it('disables the switch with a note when the feature is unavailable', async () => {
    mockBackupApi({ initial: { success: true, available: false, enabled: false, retentionDays: 30, trashCount: 0 } });
    render(<DishBackupCard onOpenTrash={vi.fn()} />);

    expect(await screen.findByText('Available after the next database update.')).toBeInTheDocument();
    const toggle = screen.getByRole('switch');
    expect(toggle).toBeDisabled();
    expect(toggle).not.toBeChecked();
    expect(screen.queryByRole('button', { name: /Open Trash/ })).not.toBeInTheDocument();

    fireEvent.click(toggle);
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
    expect(putCalls()).toHaveLength(0);
  });

  it('reverts the switch and shows the error when saving fails', async () => {
    mockBackupApi({ putResponses: [{ status: 500, body: { success: false, message: 'Server error. Please try again.' } }] });
    render(<DishBackupCard onOpenTrash={vi.fn()} />);
    const toggle = screen.getByRole('switch');
    await waitFor(() => expect(toggle).toBeChecked());

    fireEvent.click(toggle);
    fireEvent.click(screen.getByRole('button', { name: 'Turn off' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Server error. Please try again.');
    expect(toggle).toBeChecked();
    expect(toggle).toHaveAttribute('aria-checked', 'true');
    expect(toggle).toBeEnabled();
  });

  it('falls back to a generic message when the save request cannot reach the server', async () => {
    mockBackupApi({ initial: statusBody({ enabled: false }) });
    render(<DishBackupCard onOpenTrash={vi.fn()} />);
    const toggle = screen.getByRole('switch');
    await waitFor(() => expect(toggle).toBeEnabled());

    global.fetch.mockImplementationOnce(() => Promise.resolve({ ok: false, status: 502, json: async () => { throw new Error('not json'); } }));
    fireEvent.click(toggle);

    expect(await screen.findByRole('alert')).toHaveTextContent("Couldn't save the dish backup setting.");
    expect(toggle).not.toBeChecked();
  });

  it('shows a load error with a retry', async () => {
    global.fetch = vi.fn(() => Promise.reject(new TypeError('Failed to fetch')));
    render(<DishBackupCard onOpenTrash={vi.fn()} />);

    expect(await screen.findByRole('alert')).toHaveTextContent("Couldn't load the dish backup setting. Check your connection and try again.");
    expect(screen.getByRole('switch')).toBeDisabled();

    mockBackupApi();
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
    await waitFor(() => expect(screen.getByRole('switch')).toBeChecked());
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });
});
