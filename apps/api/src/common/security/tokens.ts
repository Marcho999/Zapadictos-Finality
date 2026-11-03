import { createHash, randomBytes } from 'node:crypto';

/** Token aleatorio de 256 bits en base64url (refresh tokens). */
export function randomToken(): string {
  return randomBytes(32).toString('base64url');
}

/** SHA-256 en hexadecimal: en la base solo se guarda el hash del refresh token. */
export function sha256(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}
