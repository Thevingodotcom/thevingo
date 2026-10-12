import { useCallback, useState } from 'react';
import { useAuth } from './AuthContext';
import { removeAvatar, uploadAvatar, validateAvatarFile } from './avatarApi';

/**
 * Upload/remove the current user's profile photo and sync the result into
 * AuthContext's currentUser + authStorage (so it survives reloads).
 */
export function useAvatarActions() {
  const { updateUser } = useAuth();
  const [isBusy, setIsBusy] = useState(false);
  const [error, setError] = useState('');

  const clearError = useCallback(() => setError(''), []);

  const upload = useCallback(async (file) => {
    const validationError = validateAvatarFile(file);
    if (validationError) {
      setError(validationError);
      return false;
    }
    setIsBusy(true);
    setError('');
    try {
      const user = await uploadAvatar(file);
      updateUser({ ...user, avatar: user.avatar || null });
      return true;
    } catch (err) {
      setError(err.message || 'Could not upload the photo.');
      return false;
    } finally {
      setIsBusy(false);
    }
  }, [updateUser]);

  const remove = useCallback(async () => {
    setIsBusy(true);
    setError('');
    try {
      const user = await removeAvatar();
      updateUser({ ...user, avatar: null });
      return true;
    } catch (err) {
      setError(err.message || 'Could not remove the photo.');
      return false;
    } finally {
      setIsBusy(false);
    }
  }, [updateUser]);

  return { upload, remove, isBusy, error, clearError };
}

export default useAvatarActions;
