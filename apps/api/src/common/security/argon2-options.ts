import argon2 from 'argon2';

/**
 * Parámetros mínimos recomendados por OWASP para argon2id
 * (m = 19 MiB, t = 2, p = 1). docs/06-seguridad.md, A02.
 */
export const ARGON2_OPTIONS = {
  type: argon2.argon2id,
  memoryCost: 19_456,
  timeCost: 2,
  parallelism: 1,
} as const;
