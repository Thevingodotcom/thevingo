import React, { useEffect, useState } from 'react';
import { useDishBackup } from '../../../app/useDishBackup';

export const TURN_OFF_WARNING = "Dishes you delete from now on will be permanently deleted and can't be recovered. Dishes already in Trash stay there until you empty Trash or they expire after 30 days.";

/**
 * Settings card for the per-restaurant "Dish backup" setting (default ON).
 *   ON  -> deleted dishes go to Trash and can be restored for 30 days.
 *   OFF -> deleted dishes are permanently deleted.
 * Turning OFF asks for confirmation; a failed save reverts the switch.
 */
function DishBackupCard({ onOpenTrash }) {
  const backup = useDishBackup();
  const [pendingValue, setPendingValue] = useState(null); // value being saved
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const [saveError, setSaveError] = useState('');

  const isLoading = backup.status === 'loading';
  const isAvailable = backup.status === 'ready' && backup.available;
  const isSaving = pendingValue !== null;
  const checked = isSaving ? pendingValue : (isAvailable && backup.enabled);
  const isDisabled = !isAvailable || isSaving;
  const retentionDays = backup.retentionDays;

  const persist = async (enabled) => {
    setSaveError('');
    setPendingValue(enabled);
    try {
      await backup.save(enabled);
    } catch (err) {
      // pendingValue is cleared below, so the switch falls back to the saved value.
      setSaveError(err.message || "Couldn't save the dish backup setting.");
      if (err.status === 409) backup.reload();
    } finally {
      setPendingValue(null);
    }
  };

  const requestToggle = () => {
    if (isDisabled) return;
    if (checked) {
      setIsConfirmOpen(true);
    } else {
      persist(true);
    }
  };

  const cancelTurnOff = () => setIsConfirmOpen(false);

  const confirmTurnOff = () => {
    setIsConfirmOpen(false);
    persist(false);
  };

  useEffect(() => {
    if (!isConfirmOpen) return undefined;
    const onKey = (e) => {
      if (e.key === 'Escape') setIsConfirmOpen(false);
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [isConfirmOpen]);

  return (
    <div className="settings-card dish-backup-card" style={{ marginTop: '24px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
        <h3 className="settings-card-title landing_heading2" style={{ margin: 0 }}>Dish backup</h3>
      </div>

      <div className="settings-row dish-backup-row">
        <label className="settings-label landing_body" htmlFor="settings-dish-backup" style={{ minWidth: '180px' }}>
          Keep deleted dishes in Trash
        </label>
        <div className="dish-backup-control">
          <label className="theme-switch dish-backup-switch">
            <input
              id="settings-dish-backup"
              type="checkbox"
              role="switch"
              checked={checked}
              aria-checked={checked}
              aria-describedby="dish-backup-desc"
              aria-busy={isLoading || isSaving}
              disabled={isDisabled}
              onChange={requestToggle}
              onKeyDown={(e) => {
                // Space toggles natively; Enter is a common switch shortcut too.
                if (e.key === 'Enter') {
                  e.preventDefault();
                  requestToggle();
                }
              }}
            />
            <span className="theme-switch-slider" aria-hidden="true"></span>
          </label>
          <span className="dish-backup-state" aria-hidden="true">
            {isLoading ? 'Loading…' : isSaving ? 'Saving…' : checked ? 'On' : 'Off'}
          </span>
        </div>
      </div>

      <ul id="dish-backup-desc" className="dish-backup-states landing_body">
        <li className={isAvailable && checked ? 'is-active' : ''}>
          <strong>On:</strong> deleted dishes go to Trash. You can restore them for {retentionDays} days, then they're removed automatically.
        </li>
        <li className={isAvailable && !checked ? 'is-active' : ''}>
          <strong>Off:</strong> deleted dishes are permanently deleted and can't be recovered.
        </li>
      </ul>

      {backup.status === 'ready' && !backup.available && (
        <p className="settings-photo__hint landing_body dish-backup-note">Available after the next database update.</p>
      )}

      {backup.status === 'error' && (
        <p className="settings-photo__error dish-backup-load-error" role="alert">
          {backup.error}{' '}
          <button type="button" className="dish-backup-retry" onClick={backup.reload}>Try again</button>
        </p>
      )}

      {saveError && <p className="settings-photo__error" role="alert">{saveError}</p>}

      {isAvailable && onOpenTrash && (
        <div className="dish-backup-actions">
          <button type="button" className="settings-photo__btn" onClick={onOpenTrash}>
            Open Trash ({backup.trashCount})
          </button>
        </div>
      )}

      {isConfirmOpen && (
        <div className="modal-overlay dish-backup-confirm-overlay" onClick={cancelTurnOff}>
          <div
            className="modal-content dish-backup-confirm"
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="dish-backup-confirm-title"
            aria-describedby="dish-backup-confirm-desc"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="modal-header">
              <h3 id="dish-backup-confirm-title" className="modal-title landing_heading2">Turn off dish backup?</h3>
            </div>
            <p id="dish-backup-confirm-desc" className="dish-backup-confirm-text landing_body">{TURN_OFF_WARNING}</p>
            <div className="modal-footer">
              <button type="button" className="btn btn-secondary landing_button" onClick={cancelTurnOff} autoFocus>
                Keep backup on
              </button>
              <button type="button" className="btn btn-primary dish-backup-confirm-danger landing_button" onClick={confirmTurnOff}>
                Turn off
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default DishBackupCard;
