import { API_URL } from '../config';
import authStorage from './authStorage';

/**
 * Profile photo API client.
 *   PUT    /api/auth/avatar  multipart/form-data, field "avatar" (JPG/PNG/GIF/WEBP, <= 2MB)
 *   DELETE /api/auth/avatar
 * Both respond { success, message, user } where user.avatar is a relative path
 * (e.g. "/uploads/avatar-12-...png") or null.
 */

export const AVATAR_MAX_BYTES = 2 * 1024 * 1024;
export const AVATAR_ACCEPT = 'image/png,image/jpeg,image/gif,image/webp';
const ALLOWED_TYPES = AVATAR_ACCEPT.split(',');

export const validateAvatarFile = (file) => {
  if (!file) return 'Please choose an image.';
  if (!ALLOWED_TYPES.includes(file.type)) return 'Only JPG, PNG, GIF or WEBP images are allowed.';
  if (file.size > AVATAR_MAX_BYTES) return 'Image must be 2MB or smaller.';
  return null;
};

const readUser = async (res, fallbackMessage) => {
  let data = {};
  try {
    data = await res.json();
  } catch {
    // Non-JSON error body
  }
  if (!res.ok || !data || !data.user) {
    throw new Error((data && data.message) || fallbackMessage);
  }
  return data.user;
};

export const uploadAvatar = async (file) => {
  const formData = new FormData();
  formData.append('avatar', file);
  const res = await fetch(`${API_URL}/api/auth/avatar`, {
    method: 'PUT',
    headers: { Authorization: `Bearer ${authStorage.getToken()}` },
    body: formData
  });
  return readUser(res, 'Could not upload the photo.');
};

export const removeAvatar = async () => {
  const res = await fetch(`${API_URL}/api/auth/avatar`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${authStorage.getToken()}` }
  });
  return readUser(res, 'Could not remove the photo.');
};
