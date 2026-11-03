import { Body, Controller, Delete, Get, Header, Param, ParseUUIDPipe, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { cartAddSchema, cartMergeSchema, cartUpdateSchema, variantIdsQuerySchema, type z } from '@zapadictos/shared';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe.js';
import { CurrentCustomer, CustomerAuthGuard, type AuthenticatedCustomer } from '../customer-auth/customer-auth.guard.js';
import { CartService } from './cart.service.js';

/** Datos públicos para pintar el carrito local del visitante. */
@Controller('variants')
export class VariantsController {
  constructor(private readonly cart: CartService) {}

  @Get()
  @Header('Cache-Control', 'no-store')
  variants(@Query(new ZodValidationPipe(variantIdsQuerySchema)) query: z.output<typeof variantIdsQuerySchema>) {
    return this.cart.variants(query.ids);
  }
}

@Controller('cart')
@UseGuards(CustomerAuthGuard)
export class CartController {
  constructor(private readonly cart: CartService) {}

  @Get()
  get(@CurrentCustomer() customer: AuthenticatedCustomer) {
    return this.cart.cart(customer.id);
  }

  @Post('items')
  add(
    @CurrentCustomer() customer: AuthenticatedCustomer,
    @Body(new ZodValidationPipe(cartAddSchema)) body: z.output<typeof cartAddSchema>,
  ) {
    return this.cart.add(customer.id, body.variantId, body.quantity);
  }

  @Patch('items/:id')
  update(
    @CurrentCustomer() customer: AuthenticatedCustomer,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body(new ZodValidationPipe(cartUpdateSchema)) body: z.output<typeof cartUpdateSchema>,
  ) {
    return this.cart.update(customer.id, id, body.quantity);
  }

  @Delete('items/:id')
  remove(@CurrentCustomer() customer: AuthenticatedCustomer, @Param('id', new ParseUUIDPipe()) id: string) {
    return this.cart.remove(customer.id, id);
  }

  @Post('merge')
  merge(
    @CurrentCustomer() customer: AuthenticatedCustomer,
    @Body(new ZodValidationPipe(cartMergeSchema)) body: z.output<typeof cartMergeSchema>,
  ) {
    return this.cart.merge(customer.id, body.items);
  }
}
