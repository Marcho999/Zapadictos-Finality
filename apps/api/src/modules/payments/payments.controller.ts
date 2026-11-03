import { Body, Controller, HttpCode, Param, ParseUUIDPipe, Post, Req, UseGuards } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { paymentVerifySchema, z } from '@zapadictos/shared';
import type { Request } from 'express';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe.js';
import { SkipOriginCheck } from '../../common/security/origin.guard.js';
import { CurrentCustomer, CustomerAuthGuard, type AuthenticatedCustomer } from '../customer-auth/customer-auth.guard.js';
import { PaymentsService } from './payments.service.js';
import type { WompiEvent } from './wompi.js';

/** Forma mínima de un evento; Wompi agrega más campos, que se ignoran. */
const wompiEventSchema = z.looseObject({
  event: z.string().max(60),
  data: z.looseObject({
    transaction: z
      .looseObject({
        id: z.string().max(64),
        status: z.string().max(20),
        amount_in_cents: z.number().int(),
        currency: z.string().max(5),
        reference: z.string().max(40),
        payment_method_type: z.string().max(30).nullish(),
      })
      .optional(),
  }),
  signature: z.looseObject({ properties: z.array(z.string().max(60)).max(10), checksum: z.string().max(128) }),
  timestamp: z.union([z.number(), z.string().max(20)]),
});

@Controller('payments')
export class PaymentsController {
  constructor(private readonly payments: PaymentsService) {}

  @Post(':orderId/checkout')
  @UseGuards(CustomerAuthGuard)
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  checkout(@CurrentCustomer() customer: AuthenticatedCustomer, @Param('orderId', new ParseUUIDPipe()) orderId: string) {
    return this.payments.checkout(customer.id, orderId);
  }

  @Post(':orderId/verify')
  @HttpCode(200)
  @UseGuards(CustomerAuthGuard)
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  verify(
    @CurrentCustomer() customer: AuthenticatedCustomer,
    @Param('orderId', new ParseUUIDPipe()) orderId: string,
    @Body(new ZodValidationPipe(paymentVerifySchema)) body: z.output<typeof paymentVerifySchema>,
  ) {
    return this.payments.verify(customer.id, orderId, body.transactionId);
  }

  /** Llamada de servidor a servidor: no trae Origin ni cookies; la protege el checksum. */
  @Post('webhook')
  @HttpCode(200)
  @SkipOriginCheck()
  webhook(@Body(new ZodValidationPipe(wompiEventSchema)) body: WompiEvent, @Req() req: Request) {
    return this.payments.handleEvent(body, req.ip);
  }
}
