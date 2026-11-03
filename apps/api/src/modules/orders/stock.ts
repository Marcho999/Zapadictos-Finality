import type { Prisma } from '../../generated/prisma/client.js';

export interface StockLine {
  variantId: string;
  quantity: number;
}

/**
 * Descuenta el stock de cada línea con una actualización condicionada
 * (docs/05-reglas-negocio.md): UPDATE "Variant" SET stock = stock - n
 * WHERE id = ? AND stock >= n. En PostgreSQL esa sentencia es atómica: si dos
 * pedidos compiten por el último par, el segundo espera el bloqueo de la fila,
 * vuelve a evaluar la condición y no actualiza nada.
 *
 * Devuelve las líneas que no alcanzaron; si hay alguna, quien llama debe
 * abortar la transacción para deshacer las que sí se descontaron.
 */
export async function reserveStock(tx: Prisma.TransactionClient, lines: StockLine[]): Promise<StockLine[]> {
  const failed: StockLine[] = [];
  // Siempre en el mismo orden para que dos transacciones no se bloqueen entre sí.
  for (const line of [...lines].sort((a, b) => a.variantId.localeCompare(b.variantId))) {
    const updated = await tx.variant.updateMany({
      where: { id: line.variantId, stock: { gte: line.quantity } },
      data: { stock: { decrement: line.quantity } },
    });
    if (updated.count === 0) failed.push(line);
  }
  return failed;
}

/** Devuelve el stock de un pedido cancelado. */
export async function releaseStock(tx: Prisma.TransactionClient, lines: StockLine[]): Promise<void> {
  for (const line of [...lines].sort((a, b) => a.variantId.localeCompare(b.variantId))) {
    await tx.variant.update({ where: { id: line.variantId }, data: { stock: { increment: line.quantity } } });
  }
}

/** Error que aborta la transacción cuando falta stock. */
export class OutOfStockError extends Error {
  constructor(readonly lines: StockLine[]) {
    super('Sin stock suficiente');
  }
}
