import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { cashChange, Money } from '@coffee/domain';
import { ApiException } from '../common/api-error';
import { CLOCK, Clock } from '../common/clock';
import { OrderEntity } from '../order/order.entity';
import { lockOrder, UUID } from '../order/order-lock';
import { OrderService } from '../order/order.service';
import { OrderDto } from '../order/order.mapper';
import { PaymentTransactionEntity } from './payment-transaction.entity';
import { toTransactionDto, TransactionDto } from './payment.mapper';
import { QR_PROVIDER, QR_TTL_MS, QrPaymentProvider } from './qr-payment-provider';
import { StartPaymentDto } from './start-payment.dto';

export interface PaymentResult {
  transaction: TransactionDto;
  order: OrderDto;
}

@Injectable()
export class PaymentService {
  constructor(
    private readonly ds: DataSource,
    private readonly orders: OrderService,
    @Inject(CLOCK) private readonly clock: Clock,
    @Inject(QR_PROVIDER) private readonly qr: QrPaymentProvider,
  ) {}

  async start(staffId: string, orderId: string, dto: StartPaymentDto): Promise<PaymentResult> {
    const transaction = await this.ds.transaction(async (em) => {
      const order = await lockOrder(em, orderId);
      if (order.status !== 'PENDING_PAYMENT') throw new ApiException(409, 'ORDER_NOT_PAYABLE');

      // Starting any payment retires the order's earlier PENDING one (frees the partial unique index).
      await em.update(PaymentTransactionEntity, { orderId: order.id, status: 'PENDING' }, { status: 'EXPIRED' });

      if (dto.method === 'QR') {
        const now = this.clock.now();
        const expiresAt = new Date(now.getTime() + QR_TTL_MS);
        const { qrPayload, providerRef } = await this.qr.createQr(order.id, order.total, expiresAt);
        return em.save(em.create(PaymentTransactionEntity, {
          orderId: order.id,
          method: 'QR',
          amount: order.total,
          status: 'PENDING',
          qrPayload,
          providerRef,
          cashReceived: null,
          change: null,
          processedByStaffId: staffId,
          createdAt: now,
          completedAt: null,
          expiresAt,
        }));
      }

      const change = cashChange(order.total, dto.cashReceived ?? '');
      if (!change.ok) throw new ApiException(400, 'VALIDATION_FAILED', change.errors);

      const now = this.clock.now();
      const saved = await em.save(em.create(PaymentTransactionEntity, {
        orderId: order.id,
        method: 'CASH',
        amount: order.total,
        status: 'SUCCEEDED',
        qrPayload: null,
        providerRef: null,
        cashReceived: Money.of(dto.cashReceived as string),
        change: change.unwrap(),
        processedByStaffId: staffId,
        createdAt: now,
        completedAt: now,
        expiresAt: null,
      }));
      await em.update(OrderEntity, { id: order.id }, { status: 'PAID' });
      return saved;
    });
    return { transaction: toTransactionDto(transaction), order: await this.orders.get(orderId) };
  }

  /** GET /payments/:id: a PENDING transaction past its expiry is persisted as EXPIRED first. */
  async get(txId: string): Promise<PaymentResult> {
    if (!UUID.test(txId)) throw new NotFoundException();
    let tx = await this.ds.getRepository(PaymentTransactionEntity).findOneBy({ id: txId });
    if (!tx) throw new NotFoundException();
    if (this.isExpired(tx)) {
      await this.ds.getRepository(PaymentTransactionEntity).update({ id: tx.id, status: 'PENDING' }, { status: 'EXPIRED' });
      tx = await this.ds.getRepository(PaymentTransactionEntity).findOneByOrFail({ id: txId });
    }
    return { transaction: toTransactionDto(tx), order: await this.orders.get(tx.orderId) };
  }

  /** Dev-only: pretend the customer paid. */
  async mockConfirm(txId: string): Promise<PaymentResult> {
    if (!UUID.test(txId)) throw new NotFoundException();
    const outcome = await this.ds.transaction(async (em): Promise<'PAID' | 'EXPIRED' | 'NOT_PAYABLE'> => {
      const first = await em.findOneBy(PaymentTransactionEntity, { id: txId });
      if (!first) throw new NotFoundException();
      const order = await lockOrder(em, first.orderId);
      // Re-read under the lock: another request may have changed it while we waited.
      const tx = await em.findOneByOrFail(PaymentTransactionEntity, { id: txId });
      if (this.isExpired(tx)) {
        await em.update(PaymentTransactionEntity, { id: tx.id }, { status: 'EXPIRED' });
        return 'EXPIRED';
      }
      if (tx.status === 'EXPIRED') return 'EXPIRED';
      if (tx.status !== 'PENDING' || order.status !== 'PENDING_PAYMENT') return 'NOT_PAYABLE';
      await em.update(PaymentTransactionEntity, { id: tx.id }, { status: 'SUCCEEDED', completedAt: this.clock.now() });
      await em.update(OrderEntity, { id: order.id }, { status: 'PAID' });
      return 'PAID';
    });
    // Thrown after the transaction callback returns, so the EXPIRED update above is already committed.
    if (outcome === 'EXPIRED') throw new ApiException(409, 'PAYMENT_EXPIRED');
    if (outcome === 'NOT_PAYABLE') throw new ApiException(409, 'ORDER_NOT_PAYABLE');
    return this.get(txId);
  }

  private isExpired(tx: PaymentTransactionEntity): boolean {
    return tx.status === 'PENDING' && tx.expiresAt !== null && this.clock.now().getTime() > tx.expiresAt.getTime();
  }
}
