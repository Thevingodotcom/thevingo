import React, { useCallback, useEffect, useRef, useState } from 'react';
import { DEFAULT_DISH_IMAGE, getImageUrl } from '../../../config';
import { haptics } from '../../../utils/haptics';
import {
  DEFAULT_RETENTION_DAYS,
  deleteTrashedDishes,
  describeTrashTiming,
  emptyTrash,
  fetchTrash,
  restoreTrashedDishes
} from '../../../app/dishBackupApi';
import './TrashDialog.css';

const TrashIcon = ({ size = 16 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <polyline points="3 6 5 6 21 6"></polyline>
    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
  </svg>
);

const plural = (count, one, many) => `${count} ${count === 1 ? one : many}`;
const sameId = (a, b) => String(a) === String(b);

/**
 * Trash for deleted dishes (Dish backup ON). Lists GET /api/menu/trash and lets the
 * owner restore, delete forever or empty Trash. `onChanged({ type, ...response })`
 * fires after every successful change so the caller can refresh the menu / count.
 */
function TrashDialog({ onClose, onChanged, backupEnabled = true, retentionDays = DEFAULT_RETENTION_DAYS }) {
  const [phase, setPhase] = useState('loading'); // 'loading' | 'error' | 'ready'
  const [loadError, setLoadError] = useState('');
  const [dishes, setDishes] = useState([]);
  const [retention, setRetention] = useState(retentionDays);
  const [selectedIds, setSelectedIds] = useState([]);
  const [busyAction, setBusyAction] = useState(null); // 'restore' | 'delete' | 'empty'
  const [actionError, setActionError] = useState('');
  const [notice, setNotice] = useState('');
  const [confirm, setConfirm] = useState(null); // 'delete' | 'empty'
  const dialogRef = useRef(null);
  const selectAllRef = useRef(null);
  const mountedRef = useRef(true);
  const loadRequestRef = useRef(0);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const load = useCallback(async () => {
    const requestId = ++loadRequestRef.current;
    setPhase('loading');
    setLoadError('');
    try {
      const data = await fetchTrash();
      if (!mountedRef.current || requestId !== loadRequestRef.current) return;
      setDishes(data.dishes);
      setRetention(data.retentionDays);
      setSelectedIds([]);
      setPhase('ready');
    } catch (err) {
      if (!mountedRef.current || requestId !== loadRequestRef.current) return;
      setLoadError(err.message || "Couldn't load Trash.");
      setPhase('error');
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    dialogRef.current?.focus();
  }, []);

  const isBusy = busyAction !== null;

  const handleClose = useCallback(() => {
    if (!isBusy) onClose();
  }, [isBusy, onClose]);

  // Escape closes the confirmation first, then the dialog.
  useEffect(() => {
    const onKey = (e) => {
      if (e.key !== 'Escape' || isBusy) return;
      if (confirm) {
        setConfirm(null);
      } else {
        onClose();
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [confirm, isBusy, onClose]);

  const allSelected = dishes.length > 0 && selectedIds.length === dishes.length;
  const someSelected = selectedIds.length > 0 && !allSelected;

  useEffect(() => {
    if (selectAllRef.current) selectAllRef.current.indeterminate = someSelected;
  }, [someSelected, phase]);

  const toggleSelected = (id) => {
    setSelectedIds(prev => (prev.some(x => sameId(x, id)) ? prev.filter(x => !sameId(x, id)) : [...prev, id]));
  };

  const toggleSelectAll = () => {
    setSelectedIds(allSelected ? [] : dishes.map(dish => dish.id));
  };

  const runAction = async (type, perform, describe) => {
    setBusyAction(type);
    setActionError('');
    setNotice('');
    try {
      const result = await perform();
      if (!mountedRef.current) return;
      setNotice(describe(result || {}));
      setConfirm(null);
      haptics?.success?.();
      onChanged?.({ type, ...(result || {}) });
    } catch (err) {
      if (!mountedRef.current) return;
      haptics?.error?.();
      setConfirm(null);
      setActionError(err.message || 'Something went wrong. Please try again.');
    } finally {
      if (mountedRef.current) setBusyAction(null);
    }
  };

  const removeFromList = (ids) => {
    setDishes(prev => prev.filter(dish => !ids.some(id => sameId(id, dish.id))));
    setSelectedIds([]);
  };

  const handleRestore = () => {
    const ids = [...selectedIds];
    if (ids.length === 0 || isBusy) return;
    runAction('restore', async () => {
      const result = await restoreTrashedDishes(ids);
      removeFromList(ids);
      return result;
    }, (result) => {
      const restored = Number(result.restored ?? ids.length) || 0;
      const categories = Number(result.restoredCategories) || 0;
      return `Restored ${plural(restored, 'dish', 'dishes')}${categories > 0 ? ` and ${plural(categories, 'category', 'categories')}` : ''} to your menu.`;
    });
  };

  const handleDeleteForever = () => {
    const ids = [...selectedIds];
    if (ids.length === 0 || isBusy) return;
    runAction('delete', async () => {
      const result = await deleteTrashedDishes(ids);
      removeFromList(ids);
      return result;
    }, (result) => `Permanently deleted ${plural(Number(result.deleted ?? ids.length) || 0, 'dish', 'dishes')}.`);
  };

  const handleEmptyTrash = () => {
    if (isBusy) return;
    const count = dishes.length;
    runAction('empty', async () => {
      const result = await emptyTrash();
      setDishes([]);
      setSelectedIds([]);
      return result;
    }, (result) => `Trash emptied. ${plural(Number(result.deleted ?? count) || 0, 'dish was', 'dishes were')} permanently deleted.`);
  };

  const selectedCount = selectedIds.length;

  let body;
  if (phase === 'loading') {
    body = (
      <div className="trash-state" role="status">
        <span className="trash-spinner" aria-hidden="true"></span>
        Loading Trash…
      </div>
    );
  } else if (phase === 'error') {
    body = (
      <div className="trash-state trash-state--error" role="alert">
        <p className="trash-state-title">Couldn't load Trash</p>
        <p className="trash-state-text">{loadError}</p>
        <button type="button" className="trash-btn trash-btn--secondary" onClick={load}>Try again</button>
      </div>
    );
  } else if (dishes.length === 0) {
    body = (
      <div className="trash-state trash-state--empty">
        <span className="trash-state-icon"><TrashIcon size={28} /></span>
        <p className="trash-state-title">Trash is empty</p>
        <p className="trash-state-text">
          {backupEnabled
            ? `Dishes you delete will appear here for ${retention} days, so you can restore them.`
            : "Dish backup is off, so dishes you delete are permanently deleted and don't appear here."}
        </p>
      </div>
    );
  } else {
    body = (
      <>
        <div className="trash-toolbar">
          <label className="trash-select-all">
            <input
              ref={selectAllRef}
              type="checkbox"
              className="trash-checkbox"
              checked={allSelected}
              onChange={toggleSelectAll}
              disabled={isBusy}
              aria-label="Select all dishes in Trash"
            />
            <span>Select all</span>
          </label>
          <span className="trash-selected-count" aria-live="polite">
            {selectedCount > 0 ? `${selectedCount} of ${dishes.length} selected` : plural(dishes.length, 'dish', 'dishes')}
          </span>
        </div>

        <ul className="trash-list" aria-label="Dishes in Trash">
          {dishes.map(dish => {
            const checked = selectedIds.some(id => sameId(id, dish.id));
            const isVeg = dish.isVeg === true || dish.isVeg === 1 || dish.isVeg === 'true';
            const trashedTitle = dish.trashedAt ? new Date(dish.trashedAt).toLocaleString() : undefined;
            return (
              <li key={dish.id} className={`trash-row${checked ? ' is-selected' : ''}`}>
                <label className="trash-row-label">
                  <input
                    type="checkbox"
                    className="trash-checkbox"
                    checked={checked}
                    onChange={() => toggleSelected(dish.id)}
                    disabled={isBusy}
                    aria-label={`Select ${dish.name}`}
                  />
                  <img
                    src={getImageUrl(dish.image)}
                    alt=""
                    className="trash-row-img"
                    loading="lazy"
                    onError={(e) => {
                      e.currentTarget.onerror = null;
                      e.currentTarget.src = DEFAULT_DISH_IMAGE;
                    }}
                  />
                  <span className="trash-row-info">
                    <span className="trash-row-name-line">
                      <span className={`veg-box ${isVeg ? '' : 'non-veg'}`} title={isVeg ? 'Veg' : 'Non Veg'}>
                        <span className={`veg-dot ${isVeg ? '' : 'non-veg'}`}></span>
                      </span>
                      <span className="trash-row-name">{dish.name}</span>
                    </span>
                    <span className="trash-row-category">
                      {dish.categoryName || 'No category'}
                      {dish.categoryDeleted && (
                        <span className="trash-row-hint">Category deleted, will be restored</span>
                      )}
                    </span>
                    <span className="trash-row-timing" title={trashedTitle}>
                      {describeTrashTiming(dish.trashedAt, dish.expiresAt).split(' · ').map((part, index) => (
                        <React.Fragment key={part}>
                          {index > 0 && ' · '}
                          <span className="trash-row-timing-part">{part}</span>
                        </React.Fragment>
                      ))}
                    </span>
                  </span>
                  <span className="trash-row-price">{dish.price} Rs</span>
                </label>
              </li>
            );
          })}
        </ul>
      </>
    );
  }

  const hasDishes = phase === 'ready' && dishes.length > 0;

  return (
    <>
      <div className="modal-overlay trash-overlay" onClick={handleClose}>
        <div
          ref={dialogRef}
          className="trash-modal"
          role="dialog"
          aria-modal="true"
          aria-labelledby="trash-dialog-title"
          aria-describedby="trash-dialog-desc"
          tabIndex={-1}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="trash-modal-header">
            <div className="trash-modal-heading">
              <h3 id="trash-dialog-title" className="trash-modal-title">Trash</h3>
              <p id="trash-dialog-desc" className="trash-modal-subtitle">
                Deleted dishes stay here for {retention} days, then they're removed automatically.
              </p>
            </div>
            <button
              type="button"
              className="trash-close-btn"
              onClick={handleClose}
              disabled={isBusy}
              aria-label="Close Trash"
              title="Close"
            >
              ✕
            </button>
          </div>

          <div className="trash-modal-body">
            {notice && <div className="trash-notice" role="status">{notice}</div>}
            {actionError && <div className="trash-error-banner" role="alert">{actionError}</div>}
            {body}
          </div>

          {hasDishes && (
            <div className="trash-modal-footer">
              <button
                type="button"
                className="trash-btn trash-btn--primary"
                onClick={handleRestore}
                disabled={selectedCount === 0 || isBusy}
              >
                {busyAction === 'restore' ? 'Restoring…' : selectedCount > 0 ? `Restore (${selectedCount})` : 'Restore'}
              </button>
              <button
                type="button"
                className="trash-btn trash-btn--danger-outline"
                onClick={() => setConfirm('delete')}
                disabled={selectedCount === 0 || isBusy}
              >
                Delete forever
              </button>
              <button
                type="button"
                className="trash-btn trash-btn--link-danger"
                onClick={() => setConfirm('empty')}
                disabled={isBusy}
              >
                Empty Trash
              </button>
            </div>
          )}
        </div>
      </div>

      {confirm && (
        <div className="modal-overlay trash-confirm-overlay" onClick={() => !isBusy && setConfirm(null)}>
          <div
            className="category-modal-content"
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="trash-confirm-title"
            aria-describedby="trash-confirm-desc"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="category-modal-header">
              <h3 id="trash-confirm-title" className="category-modal-title">
                {confirm === 'empty' ? 'Empty Trash?' : 'Delete forever?'}
              </h3>
            </div>
            <div className="menu-confirm-body">
              <p id="trash-confirm-desc" className="menu-confirm-text">
                {confirm === 'empty'
                  ? `All ${plural(dishes.length, 'dish', 'dishes')} in Trash will be permanently deleted, along with their photos. This can't be undone.`
                  : `The ${plural(selectedCount, 'selected dish', 'selected dishes')} will be permanently deleted, along with ${selectedCount === 1 ? 'its photo' : 'their photos'}. This can't be undone.`}
              </p>
              <div className="category-modal-footer">
                <button
                  type="button"
                  className="btn-create-category menu-btn-danger"
                  onClick={confirm === 'empty' ? handleEmptyTrash : handleDeleteForever}
                  disabled={isBusy}
                >
                  {isBusy ? 'Deleting…' : confirm === 'empty' ? 'Empty Trash' : 'Delete forever'}
                </button>
                <button
                  type="button"
                  className="btn-cancel-category"
                  onClick={() => setConfirm(null)}
                  disabled={isBusy}
                  autoFocus
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

export default TrashDialog;
