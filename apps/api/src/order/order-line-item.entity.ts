import { Column, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import type { Category, Money } from '@coffee/domain';
import { moneyTransformer } from '../common/money.transformer';
import { OrderLineEntity } from './order-line.entity';

@Entity('order_line_items')
export class OrderLineItemEntity {
  @PrimaryGeneratedColumn('uuid') id: string;
  @ManyToOne(() => OrderLineEntity, (l) => l.items) @JoinColumn({ name: 'order_line_id' }) orderLine: OrderLineEntity;
  @Column({ name: 'menu_item_id', type: 'uuid' }) menuItemId: string;
  @Column({ type: 'varchar' }) code: string;
  @Column({ type: 'varchar' }) category: Category;
  @Column({ name: 'name_en', type: 'varchar' }) nameEn: string;
  @Column({ name: 'name_th', type: 'varchar' }) nameTh: string;
  @Column({ name: 'unit_price', type: 'numeric', precision: 12, scale: 2, transformer: moneyTransformer }) unitPrice: Money;
  @Column({ type: 'int' }) count: number;
  @Column({ type: 'int' }) position: number;
}
