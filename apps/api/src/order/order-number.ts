import { EntityManager } from 'typeorm';
import { Injectable } from '@nestjs/common';

/** 'YYYY-MM-DD' + sequence -> 'YYYYMMDD-NNNN'; widens naturally past 9999 (R§10.1). */
export function formatOrderNumber(date: string, seq: number): string {
  return `${date.replaceAll('-', '')}-${String(seq).padStart(4, '0')}`;
}

@Injectable()
export class OrderNumberAllocator {
  /** Atomic per-day counter (D§5.2). Must run on the caller's transaction manager so the row lock lasts until commit. */
  async next(em: EntityManager, date: string): Promise<number> {
    const rows: { last_value: number }[] = await em.query(
      `INSERT INTO order_number_counters (business_date, last_value) VALUES ($1, 1)
       ON CONFLICT (business_date) DO UPDATE SET last_value = order_number_counters.last_value + 1
       RETURNING last_value`,
      [date],
    );
    return rows[0].last_value;
  }
}
