import { API_URL } from '../config';
import authStorage from './authStorage';

/**
 * Dish backup / Trash API client (all endpoints need the Bearer token).
 *   GET    /api/menu/backup         -> { success, available, enabled, retentionDays, trashCount }
 *   PUT    /api/menu/backup         { enabled } -> same shape (409 while the feature is unavailable)
 *   GET    /api/menu/trash          -> { success, available, enabled, retentionDays, dishes: [...] }
 *   POST   /api/menu/trash/restore  { dishIds } -> { success, restored, restoredCategories, message }
 *   POST   /api/menu/trash/delete   { dishIds } -> { success, deleted }
 *   DELETE /api/menu/trash          -> { success, deleted }
 */

export const DEFAULT_RETENTION_DAYS = 30;

const request = async (path, { method = 'GET', body, fallbackMessage }) => {
  const headers = { Authorization: `Bearer ${authStorage.getToken()}` };
  if (body !== undefined) headers['Content-Type'] = 'application/json';

  let res;
  try {
    res = await fetch(`${API_URL}${path}`, {
      method,
      headers,
      cache: 'no-store',
      body: body !== undefined ? JSON.stringify(body) : undefined
    });
  } catch {
    // Network failure: show the friendly message, not "Failed to fetch".
    throw new Error(`${fallbackMessage} Check your connection and try again.`);
  }

  let data = null;
  try {
    data = await res.json();
  } catch {
    // Non-JSON body (e.g. proxy error page)
  }
  if (!res.ok || !data || data.success === false) {
    const error = new Error((data && data.message) || fallbackMessage);
    error.status = res.status;
    throw error;
  }
  return data;
};

const normalizeStatus = (data) => {
  const available = data.available === true;
  return {
    available,
    enabled: available && data.enabled === true,
    retentionDays: Number(data.retentionDays) > 0 ? Number(data.retentionDays) : DEFAULT_RETENTION_DAYS,
    trashCount: available && Number(data.trashCount) > 0 ? Number(data.trashCount) : 0
  };
};

export const fetchBackupStatus = async () => normalizeStatus(await request('/api/menu/backup', {
  fallbackMessage: "Couldn't load the dish backup setting."
}));

export const saveBackupEnabled = async (enabled) => normalizeStatus(await request('/api/menu/backup', {
  method: 'PUT',
  body: { enabled },
  fallbackMessage: "Couldn't save the dish backup setting."
}));

export const fetchTrash = async () => {
  const data = await request('/api/menu/trash', { fallbackMessage: "Couldn't load Trash." });
  return {
    ...normalizeStatus({ ...data, trashCount: Array.isArray(data.dishes) ? data.dishes.length : 0 }),
    dishes: Array.isArray(data.dishes) ? data.dishes : []
  };
};

export const restoreTrashedDishes = (dishIds) => request('/api/menu/trash/restore', {
  method: 'POST',
  body: { dishIds },
  fallbackMessage: "Couldn't restore the selected dishes."
});

export const deleteTrashedDishes = (dishIds) => request('/api/menu/trash/delete', {
  method: 'POST',
  body: { dishIds },
  fallbackMessage: "Couldn't delete the selected dishes."
});

export const emptyTrash = () => request('/api/menu/trash', {
  method: 'DELETE',
  fallbackMessage: "Couldn't empty Trash."
});

/**
 * Which delete wording to use: 'on' (dishes go to Trash), 'off' (permanent)
 * or 'unavailable' (feature not migrated yet, still loading, or failed to load:
 * keep today's wording).
 */
export const getBackupMode = (backup) => {
  if (!backup || backup.status !== 'ready' || !backup.available) return 'unavailable';
  return backup.enabled ? 'on' : 'off';
};

const DAY_MS = 24 * 60 * 60 * 1000;

/** "Deleted 3 days ago · removed in 27 days" for a Trash row. */
export const describeTrashTiming = (trashedAt, expiresAt, now = Date.now()) => {
  const trashedMs = Date.parse(trashedAt);
  const expiresMs = Date.parse(expiresAt);
  const parts = [];

  if (!Number.isNaN(trashedMs)) {
    const daysAgo = Math.max(0, Math.floor((now - trashedMs) / DAY_MS));
    parts.push(daysAgo === 0 ? 'Deleted today' : `Deleted ${daysAgo} day${daysAgo === 1 ? '' : 's'} ago`);
  }
  if (!Number.isNaN(expiresMs)) {
    const daysLeft = Math.ceil((expiresMs - now) / DAY_MS);
    parts.push(daysLeft <= 1 ? 'removed within a day' : `removed in ${daysLeft} days`);
  }
  return parts.join(' · ');
};
