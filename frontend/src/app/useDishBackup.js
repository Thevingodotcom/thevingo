import { useCallback, useEffect, useRef, useState } from 'react';
import { DEFAULT_RETENTION_DAYS, fetchBackupStatus, saveBackupEnabled } from './dishBackupApi';

const INITIAL_STATE = {
  status: 'loading', // 'loading' | 'ready' | 'error'
  available: false,
  enabled: false,
  retentionDays: DEFAULT_RETENTION_DAYS,
  trashCount: 0,
  error: ''
};

/**
 * Loads the per-restaurant "Dish backup" setting (GET /api/menu/backup) on mount.
 * `reload()` refreshes it silently (keeps the current values on screen) and
 * `save(enabled)` persists a change; it rejects on failure so callers can revert.
 */
export function useDishBackup() {
  const [state, setState] = useState(INITIAL_STATE);
  const mountedRef = useRef(true);
  const requestRef = useRef(0);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const reload = useCallback(async () => {
    const requestId = ++requestRef.current;
    try {
      const status = await fetchBackupStatus();
      if (mountedRef.current && requestId === requestRef.current) {
        setState({ ...status, status: 'ready', error: '' });
      }
    } catch (err) {
      if (mountedRef.current && requestId === requestRef.current) {
        // Keep previously loaded values after a failed silent refresh.
        setState(prev => (prev.status === 'ready'
          ? prev
          : { ...INITIAL_STATE, status: 'error', error: err.message || "Couldn't load the dish backup setting." }));
      }
    }
  }, []);

  useEffect(() => {
    reload();
  }, [reload]);

  const save = useCallback(async (enabled) => {
    const requestId = ++requestRef.current;
    const status = await saveBackupEnabled(enabled);
    if (mountedRef.current && requestId === requestRef.current) {
      setState({ ...status, status: 'ready', error: '' });
    }
    return status;
  }, []);

  /** Locally adjust the Trash count (e.g. after a restore) without a request. */
  const setTrashCount = useCallback((updater) => {
    setState(prev => {
      const next = typeof updater === 'function' ? updater(prev.trashCount) : updater;
      return { ...prev, trashCount: Math.max(0, Number(next) || 0) };
    });
  }, []);

  return { ...state, reload, save, setTrashCount };
}

export default useDishBackup;
