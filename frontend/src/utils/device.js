/**
 * device.js
 * Persistent browser/device identifier management.
 * Reuses existing device ID stored in localStorage to ensure the same device
 * is consistently identified across browser restarts, tabs, and scan sessions.
 */

const DEVICE_ID_KEY = 'vingo_device_id';

export const getPersistentDeviceId = () => {
  try {
    if (typeof localStorage === 'undefined') {
      return 'anon_' + Math.random().toString(36).substring(2, 12);
    }

    let deviceId = localStorage.getItem(DEVICE_ID_KEY);
    if (!deviceId) {
      if (typeof crypto !== 'undefined' && crypto.randomUUID) {
        deviceId = crypto.randomUUID();
      } else {
        deviceId = 'dev_' + Date.now().toString(36) + '_' + Math.random().toString(36).substring(2, 12);
      }
      localStorage.setItem(DEVICE_ID_KEY, deviceId);
    }
    return deviceId;
  } catch {
    return 'anon_' + Math.random().toString(36).substring(2, 12);
  }
};

export default getPersistentDeviceId;
