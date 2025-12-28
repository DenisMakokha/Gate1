import { randomUUID } from 'crypto';
import { store } from './store';

export function getOrCreateDeviceId(): string {
  const existing = store.get('deviceId');
  if (existing && typeof existing === 'string' && existing.length > 0) {
    return existing;
  }

  const deviceId = `G1-${randomUUID()}`;
  store.set('deviceId', deviceId);
  return deviceId;
}
