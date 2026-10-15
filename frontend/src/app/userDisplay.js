/**
 * Display helpers for the logged-in user (navbar, settings).
 */

export const getDisplayName = (user) => {
  const name = user && typeof user.username === 'string' ? user.username.trim() : '';
  return name || 'User';
};

export const getInitials = (name) => {
  if (!name || !name.trim()) return 'U';
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) {
    return (parts[0][0] + parts[1][0]).toUpperCase();
  }
  return name.trim().slice(0, 2).toUpperCase();
};
