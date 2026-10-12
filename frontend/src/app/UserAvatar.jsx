import React, { useState } from 'react';
import { getImageUrl } from '../config';
import { getInitials } from './userDisplay';
import './UserMenu.css';

/**
 * Round avatar: the user's uploaded photo, falling back to initials when there is
 * no photo or the image fails to load.
 */
function UserAvatar({ name, avatar, className = '', isBusy = false }) {
  const [failedSrc, setFailedSrc] = useState(null);
  const src = avatar ? getImageUrl(avatar) : null;
  const showImage = Boolean(src) && failedSrc !== src;

  return (
    <span className={`user-avatar ${isBusy ? 'is-busy' : ''} ${className}`.trim()} aria-hidden="true">
      {showImage ? (
        <img src={src} alt="" className="user-avatar__img" onError={() => setFailedSrc(src)} />
      ) : (
        getInitials(name)
      )}
    </span>
  );
}

export default UserAvatar;
