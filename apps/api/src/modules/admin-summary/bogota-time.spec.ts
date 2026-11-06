import { describe, expect, it } from 'vitest';
import { startOfBogotaDay, startOfBogotaMonth } from './bogota-time.js';

describe('startOfBogotaDay', () => {
  it('las 10:00 UTC del 3 de noviembre caen en la tarde en Bogotá: el día empieza a las 05:00 UTC', () => {
    expect(startOfBogotaDay(new Date('2026-11-03T10:00:00Z')).toISOString()).toBe('2026-11-03T05:00:00.000Z');
  });

  it('antes de las 05:00 UTC, en Bogotá todavía es el día anterior', () => {
    expect(startOfBogotaDay(new Date('2026-11-03T04:59:00Z')).toISOString()).toBe('2026-11-02T05:00:00.000Z');
  });

  it('justo a las 05:00 UTC ya empezó el nuevo día en Bogotá', () => {
    expect(startOfBogotaDay(new Date('2026-11-03T05:00:00Z')).toISOString()).toBe('2026-11-03T05:00:00.000Z');
  });
});

describe('startOfBogotaMonth', () => {
  it('cualquier día del mes cae en la medianoche del día 1, en Bogotá', () => {
    expect(startOfBogotaMonth(new Date('2026-11-15T23:00:00Z')).toISOString()).toBe('2026-11-01T05:00:00.000Z');
  });

  it('antes de las 05:00 UTC del día 1, en Bogotá todavía es el mes anterior', () => {
    expect(startOfBogotaMonth(new Date('2026-11-01T02:00:00Z')).toISOString()).toBe('2026-10-01T05:00:00.000Z');
  });
});
