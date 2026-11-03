import { describe, expect, it } from 'vitest';
import { diff, redact } from './audit.service.js';

describe('redact', () => {
  it('nunca deja contraseñas, tokens ni hashes en la auditoría', () => {
    expect(
      redact({
        email: 'a@b.co',
        password: 'secreta',
        newPassword: 'otra',
        passwordHash: '$argon2id$...',
        refreshToken: 'abc',
        nested: [{ cardNumber: '4111', ok: 1 }],
      }),
    ).toEqual({
      email: 'a@b.co',
      password: '[omitido]',
      newPassword: '[omitido]',
      passwordHash: '[omitido]',
      refreshToken: '[omitido]',
      nested: [{ cardNumber: '[omitido]', ok: 1 }],
    });
  });
});

describe('diff', () => {
  it('solo devuelve los campos que cambiaron', () => {
    expect(diff({ price: 1, name: 'A' }, { price: 2, name: 'A' })).toEqual({
      price: { before: 1, after: 2 },
    });
  });
});
