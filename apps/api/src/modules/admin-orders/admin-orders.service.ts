import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import {
  ADMIN_ORDER_TRANSITIONS,
  ORDER_STATUS_LABELS,
  type AdminOrderDetailDto,
  type AdminOrderRowDto,
  type Paginated,
  type adminOrderListQuerySchema,
  type z,
} from '@zapadictos/shared';
import { ActorType, OrderStatus, Prisma } from '../../generated/prisma/client.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import { AuditService } from '../audit/audit.service.js';
import { orderInclude, orderSummaryInclude, toOrderDto, toOrderSummary } from '../orders/order-mapper.js';
import { OrdersService } from '../orders/orders.service.js';

const PAGE_SIZE = 20;

@Injectable()
export class AdminOrdersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly orders: OrdersService,
    private readonly audit: AuditService,
  ) {}

  async list(query: z.output<typeof adminOrderListQuerySchema>): Promise<Paginated<AdminOrderRowDto> & { counts: Record<string, number> }> {
    const numberMatch = query.q?.match(/^(?:ZP-?)?0*(\d{1,9})$/i);
    const where: Prisma.OrderWhereInput = {
      ...(query.status && { status: query.status }),
      ...(query.needsReview && { needsReview: true }),
      ...((query.from || query.to) && { createdAt: { gte: query.from, lte: query.to } }),
      ...(query.q && {
        OR: [
          ...(numberMatch ? [{ number: Number(numberMatch[1]) }] : []),
          { customer: { email: { contains: query.q, mode: 'insensitive' } } },
          { customer: { name: { contains: query.q, mode: 'insensitive' } } },
        ],
      }),
    };
    const [total, orders, grouped, review] = await this.prisma.$transaction([
      this.prisma.order.count({ where }),
      this.prisma.order.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (query.page - 1) * PAGE_SIZE,
        take: PAGE_SIZE,
        include: { ...orderSummaryInclude, customer: { select: { name: true, email: true } } },
      }),
      this.prisma.order.groupBy({ by: ['status'], _count: { _all: true }, orderBy: { status: 'asc' } }),
      this.prisma.order.count({ where: { needsReview: true } }),
    ]);
    const counts: Record<string, number> = { needsReview: review };
    for (const g of grouped) counts[g.status] = (g._count as { _all: number })._all;

    return {
      data: orders.map((o) => ({
        ...toOrderSummary(o),
        customerName: o.customer.name,
        customerEmail: o.customer.email,
        needsReview: o.needsReview,
      })),
      meta: { page: query.page, pageSize: PAGE_SIZE, total, totalPages: Math.max(1, Math.ceil(total / PAGE_SIZE)) },
      counts,
    };
  }

  async detail(id: string): Promise<AdminOrderDetailDto> {
    const order = await this.prisma.order.findUnique({
      where: { id },
      include: { ...orderInclude, customer: { select: { id: true, name: true, email: true } } },
    });
    if (!order) throw new NotFoundException();
    const history = await this.prisma.auditLog.findMany({
      where: { entity: 'Order', entityId: id },
      orderBy: { createdAt: 'asc' },
      include: { admin: { select: { name: true } } },
    });
    return {
      ...toOrderDto(order),
      needsReview: order.needsReview,
      customer: order.customer,
      history: history.map((h) => ({
        action: h.action,
        at: h.createdAt.toISOString(),
        actor: h.admin?.name ?? (h.actorType === ActorType.CUSTOMER ? 'Cliente' : h.actorType === ActorType.SYSTEM ? 'Sistema' : 'Wompi'),
        details: h.details,
      })),
    };
  }

  /** Transiciones permitidas (docs/05-reglas-negocio.md); cualquier otra, 409. */
  async changeStatus(id: string, next: 'SHIPPED' | 'DELIVERED' | 'CANCELLED', reason: string | undefined, admin: { adminId: string; ip?: string }) {
    const order = await this.prisma.order.findUnique({ where: { id } });
    if (!order) throw new NotFoundException();
    if (!ADMIN_ORDER_TRANSITIONS[order.status].includes(next)) {
      throw new ConflictException({
        message: `Un pedido ${ORDER_STATUS_LABELS[order.status].toLowerCase()} no puede pasar a ${ORDER_STATUS_LABELS[next].toLowerCase()}`,
      });
    }

    if (next === OrderStatus.CANCELLED) {
      const done = await this.orders.cancel(id, [order.status], reason?.trim() || 'ADMIN', { type: ActorType.ADMIN, adminId: admin.adminId });
      if (!done) throw new ConflictException({ message: 'El pedido cambió mientras tanto. Recarga e inténtalo de nuevo.' });
    } else {
      const field = next === OrderStatus.SHIPPED ? 'shippedAt' : 'deliveredAt';
      const changed = await this.prisma.order.updateMany({ where: { id, status: order.status }, data: { status: next, [field]: new Date() } });
      if (changed.count === 0) throw new ConflictException({ message: 'El pedido cambió mientras tanto. Recarga e inténtalo de nuevo.' });
      await this.audit.log({
        action: 'ORDER_STATUS_CHANGED',
        actorType: ActorType.ADMIN,
        adminId: admin.adminId,
        entity: 'Order',
        entityId: id,
        details: { from: order.status, to: next },
        ip: admin.ip,
      });
    }
    return this.detail(id);
  }

  async resolveReview(id: string, admin: { adminId: string; ip?: string }) {
    const updated = await this.prisma.order.updateMany({ where: { id, needsReview: true }, data: { needsReview: false } });
    if (updated.count === 0) throw new NotFoundException();
    await this.audit.log({ action: 'ORDER_REVIEW_RESOLVED', actorType: ActorType.ADMIN, adminId: admin.adminId, entity: 'Order', entityId: id, ip: admin.ip });
    return this.detail(id);
  }
}
