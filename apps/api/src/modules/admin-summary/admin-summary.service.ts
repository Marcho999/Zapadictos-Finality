import { Injectable } from '@nestjs/common';
import { LOW_STOCK_TOTAL, ORDER_STATUSES, type AdminSummaryDto } from '@zapadictos/shared';
import { OrderStatus } from '../../generated/prisma/client.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import { startOfBogotaDay, startOfBogotaMonth } from './bogota-time.js';

@Injectable()
export class AdminSummaryService {
  constructor(private readonly prisma: PrismaService) {}

  async get(): Promise<AdminSummaryDto> {
    const now = new Date();
    const [salesToday, salesMonth, grouped, lowStockProducts, activeOffers, ordersNeedingReview] = await Promise.all([
      this.salesSince(startOfBogotaDay(now)),
      this.salesSince(startOfBogotaMonth(now)),
      this.prisma.order.groupBy({ by: ['status'], _count: { _all: true } }),
      this.countLowStockProducts(),
      this.prisma.offer.count({ where: { active: true, startsAt: { lte: now }, endsAt: { gt: now } } }),
      this.prisma.order.count({ where: { needsReview: true } }),
    ]);

    const ordersByStatus = Object.fromEntries(ORDER_STATUSES.map((s) => [s, 0])) as Record<string, number>;
    for (const g of grouped) ordersByStatus[g.status] = (g._count as { _all: number })._all;

    return {
      salesToday,
      salesMonth,
      ordersByStatus: ordersByStatus as AdminSummaryDto['ordersByStatus'],
      lowStockProducts,
      activeOffers,
      ordersNeedingReview,
    };
  }

  /** Ventas reales desde `since`: pedidos pagados que no terminaron cancelados. */
  private async salesSince(since: Date): Promise<number> {
    const { _sum } = await this.prisma.order.aggregate({
      _sum: { total: true },
      where: { paidAt: { gte: since }, NOT: { status: OrderStatus.CANCELLED } },
    });
    return _sum.total ?? 0;
  }

  /** Mismo patrón que `admin-products.service.ts` (list): sumar stock en memoria. */
  private async countLowStockProducts(): Promise<number> {
    const products = await this.prisma.product.findMany({
      where: { active: true },
      select: {
        colors: {
          where: { active: true },
          select: { variants: { where: { active: true }, select: { stock: true } } },
        },
      },
    });
    return products.filter((p) => {
      const total = p.colors.flatMap((c) => c.variants).reduce((sum, v) => sum + v.stock, 0);
      return total > 0 && total <= LOW_STOCK_TOTAL;
    }).length;
  }
}
