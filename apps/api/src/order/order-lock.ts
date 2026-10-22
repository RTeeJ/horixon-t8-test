import { NotFoundException } from '@nestjs/common';
import { EntityManager } from 'typeorm';
import { OrderEntity } from './order.entity';

export const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Locks the order row (SELECT ... FOR UPDATE) for the rest of the transaction (D§5.3).
 * Orders only, no joins: Postgres rejects FOR UPDATE on the nullable side of an outer join.
 */
export async function lockOrder(em: EntityManager, id: string): Promise<OrderEntity> {
  // Checked first: Postgres would reject a malformed uuid with 22P02 (a 500).
  if (!UUID.test(id)) throw new NotFoundException();
  const order = await em.getRepository(OrderEntity).createQueryBuilder('o')
    .setLock('pessimistic_write')
    .where('o.id = :id', { id })
    .getOne();
  if (!order) throw new NotFoundException();
  return order;
}
