import { randomBytes, scrypt as scryptCallback } from 'node:crypto';
import { promisify } from 'node:util';

const scrypt = promisify(scryptCallback);
const keyLength = 64;

export async function hashPassword(password) {
  const salt = randomBytes(16).toString('hex');
  const derivedKey = await scrypt(password, salt, keyLength);
  return `${salt}:${Buffer.from(derivedKey).toString('hex')}`;
}
