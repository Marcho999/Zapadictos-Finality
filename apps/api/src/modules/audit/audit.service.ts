import { Injectable, Logger } from '@nestjs/common';
import { ActorType, Prisma } from '../../generated/prisma/client.js';
import { PrismaService } from '../../prisma/prisma.service.js';

export interface AuditEntry {
  action: string;
  actorType: ActorType;
  adminId?: string;
  customerId?: string;
  entity?: string;
  entityId?: string;
  details?: Record<string, unknown>;
  ip?: string;
}

/** Claves que nunca se guardan en la auditoría (docs/06-seguridad.md A09). */
const SENSITIVE_KEYS = /pass(word)?|token|secret|hash|cookie|authorization|card/i;

export function redact(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(redact);
  if (value && typeof value === 'object' && !(value instanceof Date)) {
    return Object.fromEntries(
      Object.entries(value).map(([k, v]) => [k, SENSITIVE_KEYS.test(k) ? '[omitido]' : redact(v)]),
    );
  }
  return value;
}

/** Diferencias entre dos objetos: solo los campos que cambiaron. */
export function diff(
  before: Record<string, unknown>,
  after: Record<string, unknown>,
): Record<string, { before: unknown; after: unknown }> {
  const changes: Record<string, { before: unknown; after: unknown }> = {};
  for (const key of Object.keys(after)) {
    const a = before[key] instanceof Date ? (before[key] as Date).toISOString() : before[key];
    const b = after[key] instanceof Date ? (after[key] as Date).toISOString() : after[key];
    if (JSON.stringify(a) !== JSON.stringify(b)) changes[key] = { before: a, after: b };
  }
  return changes;
}

@Injectable()
export class AuditService {
  private readonly logger = new Logger('Audit');

  constructor(private readonly prisma: PrismaService) {}

  async log(entry: AuditEntry, tx: Prisma.TransactionClient = this.prisma): Promise<void> {
    try {
      await tx.auditLog.create({
        data: {
          action: entry.action,
          actorType: entry.actorType,
          adminId: entry.adminId,
          customerId: entry.customerId,
          entity: entry.entity,
          entityId: entry.entityId,
          details: entry.details ? (redact(entry.details) as Prisma.InputJsonValue) : undefined,
          ip: entry.ip,
        },
      });
    } catch (error) {
      // Si falla dentro de una transacción, que falle todo; fuera de ella,
      // no se interrumpe la operación del usuario, pero queda en el log.
      if (tx !== this.prisma) throw error;
      this.logger.error(`No se pudo registrar ${entry.action}: ${String(error)}`);
    }
  }
}
