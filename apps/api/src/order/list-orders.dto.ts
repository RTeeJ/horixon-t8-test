import { IsIn, IsOptional, Matches } from 'class-validator';
import type { OrderStatus } from './order.entity';

// Shape only; "date within the last 8 business days" needs the clock, so OrderService.list checks it.
export class ListOrdersQuery {
  @IsOptional() @Matches(/^\d{4}-\d{2}-\d{2}$/) date?: string;
  @IsOptional() @IsIn(['PENDING_PAYMENT', 'PAID', 'VOIDED']) status?: OrderStatus;
  @IsOptional() @IsIn(['QR', 'CASH', 'NONE']) method?: 'QR' | 'CASH' | 'NONE';
  @IsOptional() @IsIn(['asc', 'desc']) sort?: 'asc' | 'desc';
}
