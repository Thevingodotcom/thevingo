import React, { useEffect, useRef, useState } from 'react';
import UserAvatar from './UserAvatar';
import { useAvatarActions } from './useAvatarActions';
import { AVATAR_ACCEPT } from './avatarApi';
import { getDisplayName } from './userDisplay';
import ThemeToggleSwitch from './ThemeToggle';
import './UserMenu.css';

/**
 * Navbar account control: the user's name beside their avatar. Clicking it opens a
 * small menu with Upload photo / Remove photo (when set) / Logout.
 */
function UserMenu({ currentUser, onLogout }) {
  const [isOpen, setIsOpen] = useState(false);
  const rootRef = useRef(null);
  const triggerRef = useRef(null);
  const fileInputRef = useRef(null);
  const { upload, remove, isBusy, error, clearError } = useAvatarActions();

  const name = getDisplayName(currentUser);
  const avatar = currentUser ? currentUser.avatar : null;

  // Close on outside click / Escape while open
  useEffect(() => {
    if (!isOpen) return undefined;
    const handlePointerDown = (event) => {
      if (rootRef.current && !rootRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };
    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        setIsOpen(false);
        triggerRef.current?.focus();
      }
    };
    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen]);

  const handleFileChange = (event) => {
    const file = event.target.files && event.target.files[0];
    // Reset so choosing the same file again still fires change
    event.target.value = '';
    if (file) upload(file);
  };

  return (
    <div className="user-menu" ref={rootRef}>
      <button
        ref={triggerRef}
        type="button"
        className="user-menu__trigger"
        aria-haspopup="menu"
        aria-expanded={isOpen}
        aria-label={`Account menu for ${name}`}
        onClick={() => {
          clearError();
          setIsOpen((open) => !open);
        }}
      >
        <span className="user-profile">
          <span className="user-name">{name}</span>
        </span>
        <UserAvatar name={name} avatar={avatar} isBusy={isBusy} />
        <svg
          className="user-menu__chevron"
          data-testid="user-menu-chevron"
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
          focusable="false"
        >
          <polyline points="6 9 12 15 18 9"></polyline>
        </svg>
      </button>

      <input
        ref={fileInputRef}
        type="file"
        accept={AVATAR_ACCEPT}
        onChange={handleFileChange}
        hidden
        data-testid="navbar-avatar-input"
      />

      {isOpen && (
        <div className="user-menu__dropdown" role="menu" aria-label="Account">
          <button
            type="button"
            role="menuitem"
            className="user-menu__item"
            disabled={isBusy}
            onClick={() => {
              setIsOpen(false);
              fileInputRef.current?.click();
            }}
          >
            {isBusy ? 'Saving…' : 'Upload photo'}
          </button>
          {avatar && (
            <button
              type="button"
              role="menuitem"
              className="user-menu__item"
              disabled={isBusy}
              onClick={() => {
                setIsOpen(false);
                remove();
              }}
            >
              Remove photo
            </button>
          )}
          <div className="user-menu__divider" role="separator" />
          <div className="user-menu__item user-menu__item--row">
            <span id="user-menu-theme-label">Dark mode</span>
            <ThemeToggleSwitch id="user-menu-theme-toggle" />
          </div>
          <div className="user-menu__divider" role="separator" />
          <button
            type="button"
            role="menuitem"
            className="user-menu__item user-menu__item--danger"
            onClick={() => {
              setIsOpen(false);
              onLogout();
            }}
          >
            Logout
          </button>
        </div>
      )}

      {!isOpen && error && (
        <div className="user-menu__error" role="alert">
          <span>{error}</span>
          <button type="button" className="user-menu__error-dismiss" aria-label="Dismiss" onClick={clearError}>
            ×
          </button>
        </div>
      )}
    </div>
  );
}

export default UserMenu;
