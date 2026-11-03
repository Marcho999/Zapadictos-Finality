import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { eventChecksum, integritySignature, isValidEvent, type WompiEvent } from './wompi.js';

const sha = (s: string) => createHash('sha256').update(s).digest('hex');

describe('integritySignature', () => {
  it('concatena referencia, monto, moneda, expiración y secreto (documentación de Wompi)', () => {
    expect(
      integritySignature({ reference: 'ZP-000123-1', amountInCents: 70480000, currency: 'COP', expirationTime: '2026-11-03T20:44:00.000Z', secret: 'sec' }),
    ).toBe(sha('ZP-000123-170480000COP2026-11-03T20:44:00.000Zsec'));
  });
});

describe('eventos de Wompi', () => {
  const event = (): WompiEvent => ({
    event: 'transaction.updated',
    data: { transaction: { id: '1234-1610641025-49201', status: 'APPROVED', amount_in_cents: 70480000, currency: 'COP', reference: 'ZP-000123-1' } },
    signature: { properties: ['transaction.id', 'transaction.status', 'transaction.amount_in_cents'], checksum: '' },
    timestamp: 1530291411,
  });

  it('acepta un evento con el checksum correcto, sin importar mayúsculas', () => {
    const e = event();
    expect(eventChecksum(e, 'eventos')).toBe(sha('1234-1610641025-49201APPROVED704800001530291411eventos'));
    e.signature!.checksum = eventChecksum(e, 'eventos')!.toUpperCase();
    expect(isValidEvent(e, 'eventos')).toBe(true);
  });

  it('rechaza un evento alterado, con otro secreto o sin firma', () => {
    const e = event();
    e.signature!.checksum = eventChecksum(e, 'eventos')!;
    expect(isValidEvent(e, 'otro-secreto')).toBe(false);

    const tampered = structuredClone(e);
    tampered.data.transaction!.amount_in_cents = 100;
    expect(isValidEvent(tampered, 'eventos')).toBe(false);

    const unsigned = event();
    delete unsigned.signature;
    expect(isValidEvent(unsigned, 'eventos')).toBe(false);
  });
});
