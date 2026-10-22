import { Column, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import type { Money } from '@coffee/domain';
import { moneyTransformer } from '../common/money.transformer';
import { OrderEntity } from '../order/order.entity';

export type PaymentMethod = 'QR' | 'CASH' | 'NONE';
export type PaymentStatus = 'PENDING' | 'SUCCEEDED' | 'FAILED' | 'EXPIRED';

const money = { type: 'numeric', precision: 12, scale: 2, transformer: moneyTransformer } as const;

@Entity('payment_transactions')
export class PaymentTransactionEntity {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ name: 'order_id', type: 'uuid' }) orderId: string;
  @ManyToOne(() => OrderEntity, (o) => o.transactions) @JoinColumn({ name: 'order_id' }) order: OrderEntity;
  @Column({ type: 'enum', enum: ['QR', 'CASH', 'NONE'], enumName: 'payment_method' }) method: PaymentMethod;
  @Column(money) amount: Money;
  @Column({ type: 'enum', enum: ['PENDING', 'SUCCEEDED', 'FAILED', 'EXPIRED'], enumName: 'payment_status' }) status: PaymentStatus;
  @Column({ name: 'qr_payload', type: 'text', nullable: true }) qrPayload: string | null;
  @Column({ name: 'provider_ref', type: 'varchar', nullable: true }) providerRef: string | null;
  @Column({ name: 'cash_received', nullable: true, ...money }) cashReceived: Money | null;
  @Column({ name: 'change', nullable: true, ...money }) change: Money | null;
  @Column({ name: 'processed_by_staff_id', type: 'uuid' }) processedByStaffId: string;
  @Column({ name: 'created_at', type: 'timestamptz' }) createdAt: Date;
  @Column({ name: 'completed_at', type: 'timestamptz', nullable: true }) completedAt: Date | null;
  @Column({ name: 'expires_at', type: 'timestamptz', nullable: true }) expiresAt: Date | null;
}
