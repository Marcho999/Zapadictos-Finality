import { Injectable, NotFoundException } from '@nestjs/common';
import type { AdminCustomerDetailDto, AdminCustomerListQuery, AdminCustomerRowDto, Paginated } from '@zapadictos/shared';
import { Prisma } from '../../generated/prisma/client.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import { CustomersService } from '../customers/customers.service.js';
import { orderSummaryInclude, toOrderSummary } from '../orders/order-mapper.js';

const PAGE_SIZE = 20;
/** Pedidos recientes que se muestran en el panel; no hace falta paginarlos aquí. */
const RECENT_ORDERS = 50;

/** Los administradores solo pueden ver a los clientes (docs/05-reglas-negocio.md): sin crear, editar ni desactivar. */
@Injectable()
export class AdminCustomersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly customers: CustomersService,
  ) {}

  async list(query: AdminCustomerListQuery): Promise<Paginated<AdminCustomerRowDto>> {
    const where: Prisma.CustomerWhereInput = query.q
      ? {
          OR: [
            { name: { contains: query.q, mode: 'insensitive' } },
            { email: { contains: query.q, mode: 'insensitive' } },
          ],
        }
      : {};
    const [total, customers] = await this.prisma.$transaction([
      this.prisma.customer.count({ where }),
      this.prisma.customer.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (query.page - 1) * PAGE_SIZE,
        take: PAGE_SIZE,
        include: { _count: { select: { orders: true } } },
      }),
    ]);

    return {
      data: customers.map((c) => ({
        id: c.id,
        name: c.name,
        email: c.email,
        phone: c.phone,
        active: c.active,
        createdAt: c.createdAt.toISOString(),
        ordersCount: c._count.orders,
      })),
      meta: { page: query.page, pageSize: PAGE_SIZE, total, totalPages: Math.max(1, Math.ceil(total / PAGE_SIZE)) },
    };
  }

  async detail(id: string): Promise<AdminCustomerDetailDto> {
    const customer = await this.prisma.customer.findUnique({ where: { id } });
    if (!customer) throw new NotFoundException();

    const [addresses, orders] = await Promise.all([
      this.customers.addresses(id),
      this.prisma.order.findMany({
        where: { customerId: id },
        orderBy: { createdAt: 'desc' },
        take: RECENT_ORDERS,
        include: orderSummaryInclude,
      }),
    ]);

    return {
      id: customer.id,
      name: customer.name,
      email: customer.email,
      phone: customer.phone,
      active: customer.active,
      dataPolicyAcceptedAt: customer.dataPolicyAcceptedAt.toISOString(),
      createdAt: customer.createdAt.toISOString(),
      addresses,
      orders: orders.map(toOrderSummary),
    };
  }
}
