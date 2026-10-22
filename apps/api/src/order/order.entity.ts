import { Column, Entity, JoinColumn, ManyToOne, OneToMany, PrimaryGeneratedColumn } from 'typeorm';
import type { Money, VoidReason } from '@coffee/domain';
import { moneyTransformer } from '../common/money.transformer';
import { StaffEntity } from '../auth/staff.entity';
import { DiscountPresetEntity } from '../discount/discount-preset.entity';
import { OrderLineEntity } from './order-line.entity';
import type { PaymentTransactionEntity } from '../payment/payment-transaction.entity';

export type OrderStatus = 'PENDING_PAYMENT' | 'PAID' | 'VOIDED';

const money = { type: 'numeric', precision: 12, scale: 2, transformer: moneyTransformer } as const;

@Entity('orders')
export class OrderEntity {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ name: 'order_number', type: 'varchar', unique: true }) orderNumber: string;
  @Column({ name: 'business_date', type: 'date' }) businessDate: string;
  @Column({ type: 'enum', enum: ['PENDING_PAYMENT', 'PAID', 'VOIDED'], enumName: 'order_status', default: 'PENDING_PAYMENT' }) status: OrderStatus;
  @Column({ name: 'created_by_staff_id', type: 'uuid' }) createdByStaffId: string;
  @ManyToOne(() => StaffEntity) @JoinColumn({ name: 'created_by_staff_id' }) createdBy: StaffEntity;
  @Column({ name: 'created_at', type: 'timestamptz' }) createdAt: Date;
  @Column(money) subtotal: Money;
  @Column({ name: 'discount_preset_id', type: 'uuid', nullable: true }) discountPresetId: string | null;
  @ManyToOne(() => DiscountPresetEntity, { nullable: true }) @JoinColumn({ name: 'discount_preset_id' }) discountPreset: DiscountPresetEntity | null;
  @Column({ name: 'discount_amount', ...money }) discountAmount: Money;
  @Column(money) total: Money;
  @Column({ name: 'vat_rate_bps', type: 'int' }) vatRateBps: number;
  @Column(money) vat: Money;
  @Column({ name: 'before_vat', ...money }) beforeVat: Money;
  @Column({ name: 'voided_at', type: 'timestamptz', nullable: true }) voidedAt: Date | null;
  @Column({ name: 'voided_by_staff_id', type: 'uuid', nullable: true }) voidedByStaffId: string | null;
  @ManyToOne(() => StaffEntity, { nullable: true }) @JoinColumn({ name: 'voided_by_staff_id' }) voidedBy: StaffEntity | null;
  @Column({ name: 'void_reason_code', type: 'enum', enum: ['CUSTOMER_CHANGED_MIND', 'WRONG_ORDER_ENTRY', 'OUT_OF_STOCK', 'CUSTOMER_LEFT_UNPAID', 'OTHER'], enumName: 'void_reason', nullable: true }) voidReasonCode: VoidReason | null;
  @Column({ name: 'void_reason_note', type: 'varchar', length: 200, nullable: true }) voidReasonNote: string | null;
  @OneToMany(() => OrderLineEntity, (l) => l.order, { cascade: ['insert'] }) lines: OrderLineEntity[];
  @OneToMany('PaymentTransactionEntity', (t: PaymentTransactionEntity) => t.order) transactions: PaymentTransactionEntity[];
}
