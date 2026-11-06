/** Colombia no tiene horario de verano: Bogotá es siempre UTC-5. */
const BOGOTA_OFFSET_MS = 5 * 60 * 60 * 1000;

/** Instante UTC que corresponde a la medianoche de hoy en Bogotá. */
export function startOfBogotaDay(now: Date): Date {
  const bogota = new Date(now.getTime() - BOGOTA_OFFSET_MS);
  const start = Date.UTC(bogota.getUTCFullYear(), bogota.getUTCMonth(), bogota.getUTCDate());
  return new Date(start + BOGOTA_OFFSET_MS);
}

/** Instante UTC que corresponde al 1.º del mes en curso, a medianoche en Bogotá. */
export function startOfBogotaMonth(now: Date): Date {
  const bogota = new Date(now.getTime() - BOGOTA_OFFSET_MS);
  const start = Date.UTC(bogota.getUTCFullYear(), bogota.getUTCMonth(), 1);
  return new Date(start + BOGOTA_OFFSET_MS);
}
