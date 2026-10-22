import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { APP_FILTER } from '@nestjs/core';
import { loadConfig } from './common/config';
import { CommonModule } from './common/common.module';
import { ErrorFilter } from './common/error.filter';
import { buildDataSourceOptions } from './database/data-source';
import { AuthModule } from './auth/auth.module';
import { MenuModule } from './menu/menu.module';
import { OrderModule } from './order/order.module';
import { PaymentModule } from './payment/payment.module';
import { DiscountModule } from './discount/discount.module';

// Feature modules (auth, orders...) are added to `imports` by later tasks.
@Module({
  imports: [
    TypeOrmModule.forRootAsync({ useFactory: () => buildDataSourceOptions(loadConfig().databaseUrl) }),
    CommonModule,
    AuthModule,
    MenuModule,
    OrderModule,
    PaymentModule,
    DiscountModule,
  ],
  providers: [{ provide: APP_FILTER, useClass: ErrorFilter }],
})
export class AppModule {}
