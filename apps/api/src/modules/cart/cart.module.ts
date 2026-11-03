import { Module } from '@nestjs/common';
import { CartController, VariantsController } from './cart.controller.js';
import { CartService } from './cart.service.js';

@Module({
  controllers: [VariantsController, CartController],
  providers: [CartService],
  exports: [CartService],
})
export class CartModule {}
