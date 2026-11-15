import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';
import { InputError } from './domain.mjs';

// Column encryption for lawyers' bank account numbers. AES-256-GCM with a random
// 96-bit IV per value. The key lives in the secrets vault, never in the database,
// so a copy of the database alone does not reveal account numbers.
const PREFIX = 'v1.';
export function parseKey(base64) {
  if (base64 === undefined || base64 === null || base64 === '') return null;
  const key = Buffer.from(String(base64), 'base64');
  if (key.length !== 32) throw new InputError('PAYMENT_DETAILS_KEY must be 32 bytes, base64 encoded', 500);
  return key;
}
export function makeAccountCipher(key) {
  if (!key) return null;
  return Object.freeze({
    encrypt(plain) {
      const iv = randomBytes(12);
      const cipher = createCipheriv('aes-256-gcm', key, iv);
      const body = Buffer.concat([cipher.update(String(plain), 'utf8'), cipher.final()]);
      return PREFIX + Buffer.concat([iv, cipher.getAuthTag(), body]).toString('base64');
    },
    decrypt(stored) {
      if (typeof stored !== 'string' || !stored.startsWith(PREFIX)) throw new InputError('Service not configured', 503);
      const raw = Buffer.from(stored.slice(PREFIX.length), 'base64');
      const decipher = createDecipheriv('aes-256-gcm', key, raw.subarray(0, 12));
      decipher.setAuthTag(raw.subarray(12, 28));
      return Buffer.concat([decipher.update(raw.subarray(28)), decipher.final()]).toString('utf8');
    }
  });
}
