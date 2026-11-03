import { createHash, timingSafeEqual } from 'node:crypto';

/**
 * Utilidades de Wompi (https://docs.wompi.co).
 * - Firma de integridad del widget: SHA256(referencia + montoEnCentavos + moneda
 *   [+ fechaExpiracion] + secretoIntegridad).
 * - Checksum de eventos: SHA256(valores de signature.properties en orden +
 *   timestamp + secretoEventos).
 */

export function integritySignature(params: {
  reference: string;
  amountInCents: number;
  currency: 'COP';
  expirationTime?: string;
  secret: string;
}): string {
  const raw = `${params.reference}${params.amountInCents}${params.currency}${params.expirationTime ?? ''}${params.secret}`;
  return createHash('sha256').update(raw).digest('hex');
}

export interface WompiTransaction {
  id: string;
  status: 'PENDING' | 'APPROVED' | 'DECLINED' | 'VOIDED' | 'ERROR';
  amount_in_cents: number;
  currency: string;
  reference: string;
  payment_method_type?: string | null;
}

export interface WompiEvent {
  event: string;
  data: { transaction?: WompiTransaction } & Record<string, unknown>;
  signature?: { properties?: unknown; checksum?: unknown };
  timestamp?: unknown;
}

/** Lee "transaction.id" dentro de event.data. */
function pathValue(data: unknown, path: string): unknown {
  return path.split('.').reduce<unknown>(
    (obj, key) => (obj && typeof obj === 'object' ? (obj as Record<string, unknown>)[key] : undefined),
    data,
  );
}

export function eventChecksum(event: WompiEvent, secret: string): string | null {
  const properties = event.signature?.properties;
  if (!Array.isArray(properties) || properties.length === 0 || properties.some((p) => typeof p !== 'string')) return null;
  if (typeof event.timestamp !== 'number' && typeof event.timestamp !== 'string') return null;
  const values = (properties as string[]).map((p) => pathValue(event.data, p));
  if (values.some((v) => v === undefined || v === null)) return null;
  return createHash('sha256').update(`${values.join('')}${event.timestamp}${secret}`).digest('hex');
}

/** Compara el checksum en tiempo constante (sin filtrar por cuánto coincidió). */
export function isValidEvent(event: WompiEvent, secret: string): boolean {
  const expected = eventChecksum(event, secret);
  const received = event.signature?.checksum;
  if (!expected || typeof received !== 'string') return false;
  const a = Buffer.from(expected, 'utf8');
  const b = Buffer.from(received.toLowerCase(), 'utf8');
  return a.length === b.length && timingSafeEqual(a, b);
}
