import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';
import type { Category } from '@coffee/domain';
import type { Money } from '@coffee/domain';
import { moneyTransformer } from '../common/money.transformer';

@Entity('menu_items')
export class MenuItemEntity {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ type: 'varchar', unique: true }) code: string;
  @Column({ type: 'varchar' }) category: Category;
  @Column({ name: 'name_en', type: 'varchar' }) nameEn: string;
  @Column({ name: 'name_th', type: 'varchar' }) nameTh: string;
  @Column({ type: 'numeric', precision: 12, scale: 2, transformer: moneyTransformer }) price: Money;
  @Column({ name: 'is_active', type: 'boolean', default: true }) isActive: boolean;
  @Column({ name: 'sort_order', type: 'int' }) sortOrder: number;
  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' }) createdAt: Date;
  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' }) updatedAt: Date;
}
