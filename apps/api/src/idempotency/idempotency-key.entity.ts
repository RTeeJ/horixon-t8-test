import { Column, Entity, PrimaryColumn } from 'typeorm';

export type IdempotencyStatus = 'IN_PROGRESS' | 'COMPLETED';

@Entity('idempotency_keys')
export class IdempotencyKeyEntity {
  @PrimaryColumn({ name: 'staff_id', type: 'uuid' }) staffId: string;
  @PrimaryColumn({ type: 'varchar', length: 100 }) key: string;
  @Column({ name: 'request_hash', type: 'char', length: 64 }) requestHash: string;
  @Column({ type: 'varchar' }) status: IdempotencyStatus;
  @Column({ name: 'response_code', type: 'int', nullable: true }) responseCode: number | null;
  @Column({ name: 'response_body', type: 'jsonb', nullable: true }) responseBody: unknown;
  @Column({ name: 'created_at', type: 'timestamptz', default: () => 'now()' }) createdAt: Date;
}
