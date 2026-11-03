import {
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { formatOrderNumber, toCents, type CheckoutSessionDto, type OrderDto } from '@zapadictos/shared';
import { loadEnv } from '../../config/env.js';
import { ActorType, OrderStatus, PaymentStatus, Prisma } from '../../generated/prisma/client.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import { AuditService } from '../audit/audit.service.js';
import { orderInclude, toOrderDto } from '../orders/order-mapper.js';
import { reserveStock, OutOfStockError } from '../orders/stock.js';
import { integritySignature, isValidEvent, type WompiEvent, type WompiTransaction } from './wompi.js';

@Injectable()
export class PaymentsService {
  private readonly logger = new Logger('Payments');

  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  private config() {
    const env = loadEnv();
    if (!env.WOMPI_PUBLIC_KEY || !env.WOMPI_INTEGRITY_SECRET || !env.WOMPI_EVENTS_SECRET) {
      throw new ServiceUnavailableException({ message: 'Los pagos todavía no están configurados. Inténtalo más tarde.' });
    }
    return {
      publicKey: env.WOMPI_PUBLIC_KEY,
      integritySecret: env.WOMPI_INTEGRITY_SECRET,
      eventsSecret: env.WOMPI_EVENTS_SECRET,
      apiUrl: env.WOMPI_API_URL,
      webOrigin: env.WEB_ORIGIN,
    };
  }

  /**
   * Crea un intento de pago y devuelve lo que necesita el widget
   * (docs/05-reglas-negocio.md, Pagos, paso 1). Cada intento tiene su propia
   * referencia: ZP-000123-1, ZP-000123-2…
   */
  async checkout(customerId: string, orderId: string): Promise<CheckoutSessionDto> {
    const config = this.config();
    const order = await this.prisma.order.findFirst({
      where: { id: orderId, customerId },
      include: { customer: true, payments: true },
    });
    if (!order) throw new NotFoundException();
    if (order.status !== OrderStatus.PENDING_PAYMENT || order.expiresAt <= new Date()) {
      throw new ConflictException({ message: 'Este pedido ya no está esperando pago.' });
    }
    if (order.payments.some((p) => p.status === PaymentStatus.APPROVED)) {
      throw new ConflictException({ message: 'Este pedido ya tiene un pago aprobado.' });
    }

    const amountInCents = toCents(order.total);
    const reference = `${formatOrderNumber(order.number)}-${order.payments.length + 1}`;
    // Wompi no deja pagar después de la expiración del pedido.
    const expirationTime = order.expiresAt.toISOString();
    await this.prisma.payment.create({ data: { orderId, reference, amountInCents, status: PaymentStatus.PENDING } });

    return {
      publicKey: config.publicKey,
      currency: 'COP',
      amountInCents,
      reference,
      signature: integritySignature({ reference, amountInCents, currency: 'COP', expirationTime, secret: config.integritySecret }),
      expirationTime,
      redirectUrl: `${config.webOrigin}/pedido/${order.id}`,
      customer: { email: order.customer.email, fullName: order.customer.name, phoneNumber: order.customer.phone },
    };
  }

  /** Webhook de Wompi: solo se acepta con el checksum correcto (A04). */
  async handleEvent(event: WompiEvent, ip?: string): Promise<{ received: true }> {
    const config = this.config();
    if (!isValidEvent(event, config.eventsSecret)) {
      await this.audit.log({ action: 'PAYMENT_EVENT_REJECTED', actorType: ActorType.ANONYMOUS, details: { event: event?.event }, ip });
      throw new UnauthorizedException({ message: 'Firma inválida' });
    }
    if (event.event === 'transaction.updated' && event.data.transaction) {
      await this.applyTransaction(event.data.transaction, 'webhook');
    }
    return { received: true };
  }

  /**
   * Respaldo del webhook (paso 4): la API le pregunta a Wompi, de servidor a
   * servidor, por la transacción. El navegador solo dice cuál consultar; el
   * resultado nunca viene de él.
   */
  async verify(customerId: string, orderId: string, transactionId: string): Promise<OrderDto> {
    const config = this.config();
    const order = await this.prisma.order.findFirst({ where: { id: orderId, customerId } });
    if (!order) throw new NotFoundException();

    const transaction = await this.fetchTransaction(config.apiUrl, transactionId);
    const payment = await this.prisma.payment.findUnique({ where: { reference: transaction.reference } });
    // La transacción debe ser de un intento de pago de ESTE pedido.
    if (!payment || payment.orderId !== order.id) throw new NotFoundException();

    await this.applyTransaction(transaction, 'verify');
    return toOrderDto(await this.prisma.order.findUniqueOrThrow({ where: { id: orderId }, include: orderInclude }));
  }

  private async fetchTransaction(apiUrl: string, id: string): Promise<WompiTransaction> {
    // URL fija de configuración + un id validado (solo letras, números y guiones): sin SSRF (A10).
    const response = await fetch(`${apiUrl}/transactions/${encodeURIComponent(id)}`, {
      signal: AbortSignal.timeout(10_000),
    }).catch(() => null);
    if (!response || response.status === 404) throw new NotFoundException({ message: 'No encontramos esa transacción' });
    if (!response.ok) throw new ServiceUnavailableException({ message: 'No pudimos consultar el pago. Inténtalo de nuevo.' });
    const body = (await response.json()) as { data?: WompiTransaction };
    if (!body.data?.reference) throw new ServiceUnavailableException({ message: 'Respuesta inesperada de la pasarela' });
    return body.data;
  }

  /**
   * Aplica el estado de una transacción a su pago y a su pedido. Es
   * idempotente: el mismo evento dos veces no cambia nada la segunda vez.
   */
  async applyTransaction(t: WompiTransaction, source: 'webhook' | 'verify'): Promise<void> {
    const payment = await this.prisma.payment.findUnique({ where: { reference: t.reference } });
    if (!payment) {
      this.logger.warn(`Transacción ${t.id} con referencia desconocida`);
      return;
    }
    if (t.amount_in_cents !== payment.amountInCents || t.currency !== 'COP') {
      await this.audit.log({
        action: 'PAYMENT_AMOUNT_MISMATCH',
        actorType: ActorType.SYSTEM,
        entity: 'Order',
        entityId: payment.orderId,
        details: { reference: t.reference, expected: payment.amountInCents, received: t.amount_in_cents, currency: t.currency },
      });
      return;
    }
    const status = PaymentStatus[t.status as keyof typeof PaymentStatus];
    if (!status || status === PaymentStatus.PENDING) return;
    // Idempotencia: el mismo evento otra vez no cambia nada.
    if (payment.status === status && payment.wompiTransactionId === t.id) return;
    // Un pago aprobado solo puede pasar a anulado (VOIDED); nada lo "desaprueba".
    if (payment.status === PaymentStatus.APPROVED && status !== PaymentStatus.VOIDED) return;

    await this.prisma.$transaction(async (tx) => {
      await tx.payment.update({
        where: { id: payment.id },
        data: {
          status,
          wompiTransactionId: t.id,
          method: t.payment_method_type ?? null,
          // Solo lo necesario: sin datos del cliente ni del medio de pago.
          rawEvent: { id: t.id, status: t.status, amount_in_cents: t.amount_in_cents, method: t.payment_method_type ?? null, source },
        },
      });
      await this.audit.log(
        { action: `PAYMENT_${status}`, actorType: ActorType.SYSTEM, entity: 'Order', entityId: payment.orderId, details: { reference: t.reference, transactionId: t.id, source } },
        tx,
      );

      if (status === PaymentStatus.APPROVED) await this.markPaid(tx, payment.orderId, t.reference);
      if (status === PaymentStatus.VOIDED && payment.status === PaymentStatus.APPROVED) {
        await tx.order.update({ where: { id: payment.orderId }, data: { needsReview: true } });
      }
    });
  }

  private async markPaid(tx: Prisma.TransactionClient, orderId: string, reference: string) {
    const now = new Date();
    const paid = await tx.order.updateMany({
      where: { id: orderId, status: OrderStatus.PENDING_PAYMENT },
      data: { status: OrderStatus.PAID, paidAt: now },
    });
    if (paid.count === 1) return;

    const order = await tx.order.findUniqueOrThrow({ where: { id: orderId }, include: { items: true } });
    if (order.status !== OrderStatus.CANCELLED) {
      // Ya estaba pagado (otro intento aprobado): cobro doble, revisar a mano.
      if (order.status === OrderStatus.PAID || order.status === OrderStatus.SHIPPED || order.status === OrderStatus.DELIVERED) {
        const otherApproved = await tx.payment.count({ where: { orderId, status: PaymentStatus.APPROVED, NOT: { reference } } });
        if (otherApproved > 0) await tx.order.update({ where: { id: orderId }, data: { needsReview: true } });
      }
      return;
    }

    // Caso límite (paso 5): pago aprobado de un pedido que ya venció. Se
    // intenta reservar el stock de nuevo en una sub-transacción (SAVEPOINT).
    try {
      await tx.$executeRaw`SAVEPOINT rereserve`;
      const failed = await reserveStock(tx, order.items.map((i) => ({ variantId: i.variantId, quantity: i.quantity })));
      if (failed.length) throw new OutOfStockError(failed);
      await tx.$executeRaw`RELEASE SAVEPOINT rereserve`;
      await tx.order.update({
        where: { id: orderId },
        data: { status: OrderStatus.PAID, paidAt: now, cancelledAt: null, cancelReason: null },
      });
      await this.audit.log({ action: 'ORDER_REVIVED', actorType: ActorType.SYSTEM, entity: 'Order', entityId: orderId }, tx);
    } catch (error) {
      if (!(error instanceof OutOfStockError)) throw error;
      await tx.$executeRaw`ROLLBACK TO SAVEPOINT rereserve`;
      await tx.order.update({ where: { id: orderId }, data: { needsReview: true } });
      await this.audit.log({ action: 'ORDER_NEEDS_REVIEW', actorType: ActorType.SYSTEM, entity: 'Order', entityId: orderId, details: { reason: 'paid_after_cancel_without_stock' } }, tx);
    }
  }
}
