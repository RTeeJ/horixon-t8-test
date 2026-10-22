import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { OrderModule } from '../order/order.module';
import { PaymentTransactionEntity } from './payment-transaction.entity';
import { PaymentController } from './payment.controller';
import { PaymentService } from './payment.service';
import { MockQrProvider, QR_PROVIDER } from './qr-payment-provider';

@Module({
  imports: [OrderModule, TypeOrmModule.forFeature([PaymentTransactionEntity])],
  providers: [PaymentService, { provide: QR_PROVIDER, useClass: MockQrProvider }],
  controllers: [PaymentController],
})
export class PaymentModule {}
