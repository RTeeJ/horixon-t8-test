import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DiscountModule } from '../discount/discount.module';
import { MenuModule } from '../menu/menu.module';
import { OrderController } from './order.controller';
import { OrderService } from './order.service';
import { OrderNumberAllocator } from './order-number';
import { OrderEntity } from './order.entity';
import { OrderLineEntity } from './order-line.entity';
import { OrderLineItemEntity } from './order-line-item.entity';
import { OrderNumberCounterEntity } from './order-number-counter.entity';

@Module({
  imports: [MenuModule, DiscountModule, TypeOrmModule.forFeature([OrderEntity, OrderLineEntity, OrderLineItemEntity, OrderNumberCounterEntity])],
  providers: [OrderService, OrderNumberAllocator],
  controllers: [OrderController],
  exports: [OrderService],
})
export class OrderModule {}
