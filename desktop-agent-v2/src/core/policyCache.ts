import crypto from 'crypto';

export type EventPolicy = {
  eventId: number;
  name?: string;
  startAtIso?: string | null;
  endAtIso?: string | null;
  autoDeleteEnabled?: boolean;
  autoDeleteDateIso?: string | null;
  autoDeleteDaysAfterEnd?: number | null;
  calculatedDeleteAtIso?: string | null;
  backupRequired?: boolean | null;
  cachedAtIso: string;
};

type CipherPayload = {
  v: 1;
  alg: 'aes-256-gcm';
  iv: string;
  tag: string;
  data: string;
};

function deriveKey(deviceId: string): Buffer {
  // machine-bound enough for Windows-first; stronger binding can be added later.
  return crypto.createHash('sha256').update(`gate1-agent-v2:${deviceId}`).digest();
}

export function encryptPolicy(deviceId: string, policy: EventPolicy): string {
  const key = deriveKey(deviceId);
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);

  const plaintext = Buffer.from(JSON.stringify(policy), 'utf8');
  const enc = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  const tag = cipher.getAuthTag();

  const payload: CipherPayload = {
    v: 1,
    alg: 'aes-256-gcm',
    iv: iv.toString('base64'),
    tag: tag.toString('base64'),
    data: enc.toString('base64'),
  };

  return JSON.stringify(payload);
}

export function decryptPolicy(deviceId: string, cipherText: string): EventPolicy | null {
  try {
    const payload = JSON.parse(cipherText) as CipherPayload;
    if (payload.v !== 1 || payload.alg !== 'aes-256-gcm') return null;

    const key = deriveKey(deviceId);
    const iv = Buffer.from(payload.iv, 'base64');
    const tag = Buffer.from(payload.tag, 'base64');
    const data = Buffer.from(payload.data, 'base64');

    const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
    decipher.setAuthTag(tag);

    const dec = Buffer.concat([decipher.update(data), decipher.final()]);
    return JSON.parse(dec.toString('utf8')) as EventPolicy;
  } catch {
    return null;
  }
}

export function computeDeleteAtIso(params: {
  endDateIso?: string | null;
  autoDeleteDateIso?: string | null;
  autoDeleteDaysAfterEnd?: number | null;
}): string | null {
  if (params.autoDeleteDateIso) {
    const t = Date.parse(params.autoDeleteDateIso);
    if (!Number.isNaN(t)) return new Date(t).toISOString();
  }

  if (params.endDateIso && params.autoDeleteDaysAfterEnd) {
    const end = Date.parse(params.endDateIso);
    if (!Number.isNaN(end)) {
      const ms = end + params.autoDeleteDaysAfterEnd * 24 * 60 * 60 * 1000;
      return new Date(ms).toISOString();
    }
  }

  return null;
}
