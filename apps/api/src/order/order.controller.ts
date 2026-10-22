import { Body, Controller, Get, HttpCode, Param, Post, Query } from '@nestjs/common';
import { CurrentStaff, CurrentStaffInfo } from '../auth/current-staff.decorator';
import { Idempotent } from '../idempotency/idempotent.decorator';
import { ListOrdersQuery } from './list-orders.dto';
import { OrderDto, OrderSummaryDto } from './order.mapper';
import { OrderService } from './order.service';
import { PlaceOrderDto } from './place-order.dto';
import { VoidOrderDto } from './void-order.dto';

@Controller('orders')
export class OrderController {
  constructor(private readonly orders: OrderService) {}

  @Post()
  @Idempotent()
  place(@CurrentStaff() staff: CurrentStaffInfo, @Body() body: PlaceOrderDto): Promise<OrderDto> {
    return this.orders.place(staff.id, body);
  }

  @Get()
  list(@Query() query: ListOrdersQuery): Promise<{ orders: OrderSummaryDto[] }> {
    return this.orders.list(query);
  }

  @Get(':id')
  get(@Param('id') id: string): Promise<OrderDto> {
    return this.orders.get(id);
  }

  @Post(':id/void')
  @Idempotent()
  @HttpCode(200)
  void(@CurrentStaff() staff: CurrentStaffInfo, @Param('id') id: string, @Body() body: VoidOrderDto): Promise<OrderDto> {
    return this.orders.void(staff.id, id, body);
  }
}
