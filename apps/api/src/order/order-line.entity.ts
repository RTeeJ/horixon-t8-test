import { Column, Entity, JoinColumn, ManyToOne, OneToMany, PrimaryGeneratedColumn } from 'typeorm';
import type { Money } from '@coffee/domain';
import { moneyTransformer } from '../common/money.transformer';
import { OrderEntity } from './order.entity';
import { OrderLineItemEntity } from './order-line-item.entity';

const money = { type: 'numeric', precision: 12, scale: 2, transformer: moneyTransformer } as const;

@Entity('order_lines')
export class OrderLineEntity {
  @PrimaryGeneratedColumn('uuid') id: string;
  @ManyToOne(() => OrderEntity, (o) => o.lines) @JoinColumn({ name: 'order_id' }) order: OrderEntity;
  @Column({ name: 'line_no', type: 'int' }) lineNo: number;
  @Column({ type: 'int' }) quantity: number;
  @Column({ name: 'unit_price', ...money }) unitPrice: Money;
  @Column({ name: 'line_total', ...money }) lineTotal: Money;
  @Column({ name: 'description_en', type: 'varchar' }) descriptionEn: string;
  @Column({ name: 'description_th', type: 'varchar' }) descriptionTh: string;
  @OneToMany(() => OrderLineItemEntity, (i) => i.orderLine, { cascade: ['insert'] }) items: OrderLineItemEntity[];
}
