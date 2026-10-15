import { describe, it, expect, beforeEach } from 'vitest';
import { getPersistentDeviceId } from './device';

describe('device identification utility', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('generates a new persistent device ID when none exists', () => {
    const deviceId = getPersistentDeviceId();
    expect(deviceId).toBeDefined();
    expect(typeof deviceId).toBe('string');
    expect(localStorage.getItem('vingo_device_id')).toBe(deviceId);
  });

  it('reuses the existing device ID across subsequent calls and scans', () => {
    localStorage.setItem('vingo_device_id', 'existing-device-uuid-1234');
    const deviceId = getPersistentDeviceId();
    expect(deviceId).toBe('existing-device-uuid-1234');
    expect(getPersistentDeviceId()).toBe('existing-device-uuid-1234');
  });
});
