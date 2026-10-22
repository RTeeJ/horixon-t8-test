import { Body, Controller, Get, HttpCode, Param, Post, UseGuards } from '@nestjs/common';
import { CurrentStaff, CurrentStaffInfo } from '../auth/current-staff.decorator';
import { Idempotent } from '../idempotency/idempotent.decorator';
import { DevOnlyGuard } from './dev-only.guard';
import { PaymentResult, PaymentService } from './payment.service';
import { StartPaymentDto } from './start-payment.dto';

@Controller()
export class PaymentController {
  constructor(private readonly payments: PaymentService) {}

  @Post('orders/:id/payments')
  @Idempotent()
  start(@CurrentStaff() staff: CurrentStaffInfo, @Param('id') id: string, @Body() body: StartPaymentDto): Promise<PaymentResult> {
    return this.payments.start(staff.id, id, body);
  }

  @Get('payments/:id')
  get(@Param('id') id: string): Promise<PaymentResult> {
    return this.payments.get(id);
  }

  @Post('payments/:id/mock-confirm')
  @UseGuards(DevOnlyGuard)
  @Idempotent()
  @HttpCode(200)
  mockConfirm(@Param('id') id: string): Promise<PaymentResult> {
    return this.payments.mockConfirm(id);
  }
}
