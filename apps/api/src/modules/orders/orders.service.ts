import { BadRequestException, ConflictException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ORDER_RESERVATION_MINUTES, type OrderDto, type OrderSummaryDto, type Paginated } from '@zapadictos/shared';
import { loadEnv } from '../../config/env.js';
import { ActorType, OrderStatus } from '../../generated/prisma/client.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import { AuditService } from '../audit/audit.service.js';
import { isPurchasable, unitPriceOf, variantForSaleInclude } from '../cart/cart.service.js';
import { orderInclude, orderSummaryInclude, toOrderDto, toOrderSummary } from './order-mapper.js';
import { OutOfStockError, releaseStock, reserveStock } from './stock.js';

/** Un cliente puede tener a lo sumo 3 pedidos sin pagar (A04). */
export const MAX_PENDING_ORDERS = 3;
const PAGE_SIZE = 10;

@Injectable()
export class OrdersService {
  private readonly logger = new Logger('Orders');

  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  /**
   * Crea el pedido desde el carrito y reserva el stock, todo en una sola
   * transacción (docs/05-reglas-negocio.md, "Pedidos y stock").
   */
  async create(customerId: string, addressId: string): Promise<OrderDto> {
    const now = new Date();
    const address = await this.prisma.address.findFirst({ where: { id: addressId, customerId } });
    if (!address) throw new BadRequestException({ message: 'Elige una de tus direcciones de envío' });

    const pending = await this.prisma.order.count({
      where: { customerId, status: OrderStatus.PENDING_PAYMENT, expiresAt: { gt: now } },
    });
    if (pending >= MAX_PENDING_ORDERS) {
      throw new ConflictException({
        message: `Tienes ${pending} pedidos esperando pago. Págalos o espera a que venzan antes de crear otro.`,
      });
    }

    const items = await this.prisma.cartItem.findMany({
      where: { customerId },
      include: { variant: { include: variantForSaleInclude } },
    });
    if (items.length === 0) throw new BadRequestException({ message: 'Tu carrito está vacío' });
    const unavailable = items.filter((i) => !isPurchasable(i.variant));
    if (unavailable.length) {
      throw new ConflictException({
        message: `Ya no está disponible: ${unavailable.map((i) => i.variant.productColor.product.name).join(', ')}. Quítalo del carrito para continuar.`,
      });
    }

    // Precios calculados aquí, nunca recibidos del frontend (A04).
    const lines = items.map((i) => {
      const { unitPrice, listPrice } = unitPriceOf(i.variant, now);
      return { item: i, unitPrice, listPrice };
    });
    const subtotal = lines.reduce((sum, l) => sum + l.unitPrice * l.item.quantity, 0);
    const shippingCost = loadEnv().SHIPPING_COST;

    try {
      const order = await this.prisma.$transaction(async (tx) => {
        const failed = await reserveStock(tx, items.map((i) => ({ variantId: i.variantId, quantity: i.quantity })));
        if (failed.length) throw new OutOfStockError(failed);

        const created = await tx.order.create({
          data: {
            customerId,
            status: OrderStatus.PENDING_PAYMENT,
            subtotal,
            shippingCost,
            total: subtotal + shippingCost,
            shipRecipientName: address.recipientName,
            shipPhone: address.phone,
            shipDepartment: address.department,
            shipCity: address.city,
            shipLine1: address.line1,
            shipNotes: address.notes,
            expiresAt: new Date(now.getTime() + ORDER_RESERVATION_MINUTES * 60_000),
            items: {
              create: lines.map(({ item, unitPrice, listPrice }) => ({
                variantId: item.variantId,
                quantity: item.quantity,
                unitPrice,
                listPrice,
                productName: item.variant.productColor.product.name,
                colorName: item.variant.productColor.name,
                size: item.variant.size,
                sku: item.variant.sku,
              })),
            },
          },
          include: orderInclude,
        });
        await tx.cartItem.deleteMany({ where: { customerId } });
        await this.audit.log(
          { action: 'ORDER_CREATED', actorType: ActorType.CUSTOMER, customerId, entity: 'Order', entityId: created.id, details: { total: created.total } },
          tx,
        );
        return created;
      });
      return toOrderDto(order);
    } catch (error) {
      if (error instanceof OutOfStockError) {
        const names = error.lines.map((l) => {
          const v = items.find((i) => i.variantId === l.variantId)!.variant;
          return `${v.productColor.product.name} talla ${v.size} (${v.productColor.name})`;
        });
        throw new ConflictException({
          message: `No hay stock suficiente de: ${names.join(', ')}. Ajusta tu carrito; no se reservó nada.`,
        });
      }
      throw error;
    }
  }

  async list(customerId: string, page: number): Promise<Paginated<OrderSummaryDto>> {
    const where = { customerId };
    const [total, orders] = await this.prisma.$transaction([
      this.prisma.order.count({ where }),
      this.prisma.order.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * PAGE_SIZE,
        take: PAGE_SIZE,
        include: orderSummaryInclude,
      }),
    ]);
    return {
      data: orders.map(toOrderSummary),
      meta: { page, pageSize: PAGE_SIZE, total, totalPages: Math.max(1, Math.ceil(total / PAGE_SIZE)) },
    };
  }

  /** Si el pedido es de otro cliente, 404: no se revela que existe (A01). */
  async detail(customerId: string, id: string): Promise<OrderDto> {
    const order = await this.prisma.order.findFirst({ where: { id, customerId }, include: orderInclude });
    if (!order) throw new NotFoundException();
    return toOrderDto(order);
  }

  /**
   * Cancela un pedido y devuelve su stock, solo si sigue en uno de los estados
   * esperados (la actualización condicionada evita carreras con el webhook).
   */
  async cancel(
    orderId: string,
    from: OrderStatus[],
    reason: string,
    actor: { type: ActorType; adminId?: string },
  ): Promise<boolean> {
    return this.prisma.$transaction(async (tx) => {
      const changed = await tx.order.updateMany({
        where: { id: orderId, status: { in: from } },
        data: { status: OrderStatus.CANCELLED, cancelledAt: new Date(), cancelReason: reason },
      });
      if (changed.count === 0) return false;
      const items = await tx.orderItem.findMany({ where: { orderId }, select: { variantId: true, quantity: true } });
      await releaseStock(tx, items);
      await this.audit.log(
        {
          action: 'ORDER_CANCELLED',
          actorType: actor.type,
          adminId: actor.adminId,
          entity: 'Order',
          entityId: orderId,
          details: { reason, from },
        },
        tx,
      );
      return true;
    });
  }

  /** Tarea programada: cancela los pedidos sin pagar que vencieron. */
  async cancelExpired(now = new Date()): Promise<number> {
    const expired = await this.prisma.order.findMany({
      where: { status: OrderStatus.PENDING_PAYMENT, expiresAt: { lt: now } },
      select: { id: true },
      take: 100,
    });
    let cancelled = 0;
    for (const { id } of expired) {
      if (await this.cancel(id, [OrderStatus.PENDING_PAYMENT], 'EXPIRED', { type: ActorType.SYSTEM })) cancelled++;
    }
    if (cancelled) this.logger.log(`Pedidos vencidos cancelados: ${cancelled}`);
    return cancelled;
  }
}
