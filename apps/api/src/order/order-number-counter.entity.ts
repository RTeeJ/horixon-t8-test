import { Column, Entity, PrimaryColumn } from 'typeorm';

@Entity('order_number_counters')
export class OrderNumberCounterEntity {
  @PrimaryColumn({ name: 'business_date', type: 'date' }) businessDate: string;
  @Column({ name: 'last_value', type: 'int' }) lastValue: number;
}
