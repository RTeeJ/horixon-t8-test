import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn } from 'typeorm';

// value and minSubtotal stay plain numeric strings: a percent is not money, so no money transformer.
@Entity('discount_presets')
export class DiscountPresetEntity {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ type: 'varchar', unique: true }) code: string;
  @Column({ name: 'name_en', type: 'varchar' }) nameEn: string;
  @Column({ name: 'name_th', type: 'varchar' }) nameTh: string;
  @Column({ type: 'enum', enumName: 'discount_type', enum: ['PERCENT', 'AMOUNT'] }) type: 'PERCENT' | 'AMOUNT';
  @Column({ type: 'numeric', precision: 12, scale: 2 }) value: string;
  @Column({ name: 'min_subtotal', type: 'numeric', precision: 12, scale: 2, nullable: true }) minSubtotal: string | null;
  @Column({ name: 'is_active', type: 'boolean', default: true }) isActive: boolean;
  @Column({ name: 'sort_order', type: 'int' }) sortOrder: number;
  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' }) createdAt: Date;
}
