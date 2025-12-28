import keytar from 'keytar';
import { KEYTAR_ACCOUNT_TOKEN, KEYTAR_ACCOUNT_TOKEN_EXPIRY, KEYTAR_SERVICE } from './constants';

export async function setToken(token: string, expiryIso: string): Promise<void> {
  await keytar.setPassword(KEYTAR_SERVICE, KEYTAR_ACCOUNT_TOKEN, token);
  await keytar.setPassword(KEYTAR_SERVICE, KEYTAR_ACCOUNT_TOKEN_EXPIRY, expiryIso);
}

export async function getToken(): Promise<{ token: string; expiryIso: string } | null> {
  const token = await keytar.getPassword(KEYTAR_SERVICE, KEYTAR_ACCOUNT_TOKEN);
  const expiryIso = await keytar.getPassword(KEYTAR_SERVICE, KEYTAR_ACCOUNT_TOKEN_EXPIRY);

  if (!token || !expiryIso) return null;
  return { token, expiryIso };
}

export async function clearToken(): Promise<void> {
  await keytar.deletePassword(KEYTAR_SERVICE, KEYTAR_ACCOUNT_TOKEN);
  await keytar.deletePassword(KEYTAR_SERVICE, KEYTAR_ACCOUNT_TOKEN_EXPIRY);
}

export function isTokenExpired(expiryIso: string, nowMs: number = Date.now()): boolean {
  const t = Date.parse(expiryIso);
  if (Number.isNaN(t)) return true;
  return t <= nowMs;
}
