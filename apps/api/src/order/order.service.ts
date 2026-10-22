import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { checkVoid, historyDates, Money, OrderInput, quoteOrder } from '@coffee/domain';
import { ApiException } from '../common/api-error';
import { businessDate, CLOCK, Clock } from '../common/clock';
import { CONFIG } from '../common/config.token';
import type { AppConfig } from '../common/config';
import { DiscountService } from '../discount/discount.service';
import { MenuService } from '../menu/menu.service';
import { StaffEntity } from '../auth/staff.entity';
import { PaymentTransactionEntity } from '../payment/payment-transaction.entity';
import { DiscountPresetEntity } from '../discount/discount-preset.entity';
import { OrderEntity } from './order.entity';
import { lockOrder } from './order-lock';
import { VoidOrderDto } from './void-order.dto';
import { OrderLineEntity } from './order-line.entity';
import { OrderLineItemEntity } from './order-line-item.entity';
import { formatOrderNumber, OrderNumberAllocator } from './order-number';
import { ListOrdersQuery } from './list-orders.dto';
import { OrderDto, OrderSummaryDto, toOrderDto, toOrderSummaryDto } from './order.mapper';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

@Injectable()
export class OrderService {
  constructor(
    private readonly ds: DataSource,
    private readonly menu: MenuService,
    private readonly discounts: DiscountService,
    private readonly numbers: OrderNumberAllocator,
    @Inject(CLOCK) private readonly clock: Clock,
    @Inject(CONFIG) private readonly cfg: AppConfig,
  ) {}

  async place(staffId: string, input: OrderInput): Promise<OrderDto> {
    // Read-only and done before the transaction so a request never holds one connection while waiting for another.
    const menu = await this.menu.loadMenu();
    const presets = await this.discounts.loadPresets();
    const quoted = quoteOrder(input, { menu, vatRateBps: this.cfg.vatRateBps, limits: this.cfg.limits, presets });
    if (!quoted.ok) throw new ApiException(400, 'VALIDATION_FAILED', quoted.errors);
    const quote = quoted.unwrap();

    const now = this.clock.now();
    const date = businessDate(now);

    return this.ds.transaction(async (em) => {
      const seq = await this.numbers.next(em, date);
      const staff = await em.findOneByOrFail(StaffEntity, { id: staffId });

      const order = em.create(OrderEntity, {
        orderNumber: formatOrderNumber(date, seq),
        businessDate: date,
        status: 'PENDING_PAYMENT',
        createdByStaffId: staff.id,
        createdAt: now,
        subtotal: quote.subtotal,
        discountPresetId: quote.discount?.preset.id ?? null,
        discountAmount: quote.discount?.amount ?? Money.zero(),
        total: quote.total,
        vatRateBps: quote.vatRateBps,
        vat: quote.vat,
        beforeVat: quote.beforeVat,
        lines: quote.lines.map((l, i) =>
          em.create(OrderLineEntity, {
            lineNo: i,
            quantity: l.quantity,
            unitPrice: l.unitPrice,
            lineTotal: l.lineTotal,
            descriptionEn: l.descriptionEn,
            descriptionTh: l.descriptionTh,
            items: l.components.map((c) =>
              em.create(OrderLineItemEntity, {
                menuItemId: c.item.id, code: c.item.code, category: c.item.category,
                nameEn: c.item.nameEn, nameTh: c.item.nameTh, unitPrice: c.item.price,
                count: c.count, position: c.position,
              }),
            ),
          }),
        ),
      });
      const saved = await em.save(order);
      saved.createdBy = staff;
      // Rebuilt from the preset already loaded for the quote, so the response needs no extra query.
      const preset = quote.discount ? presets.find((p) => p.id === quote.discount!.preset.id) : undefined;
      saved.discountPreset = preset
        ? Object.assign(new DiscountPresetEntity(), { id: preset.id, code: preset.code, nameEn: preset.nameEn, nameTh: preset.nameTh })
        : null;
      saved.transactions = [];
      saved.voidedBy = null;
      return toOrderDto(saved);
    });
  }

  /** GET /orders. Filters on business_date (the Bangkok date stored at order time), not created_at (R§14). */
  async list(q: ListOrdersQuery): Promise<{ orders: OrderSummaryDto[] }> {
    const today = businessDate(this.clock.now());
    const date = q.date ?? today;
    if (!historyDates(today).includes(date)) {
      throw new ApiException(400, 'VALIDATION_FAILED', [{ code: 'INVALID_BODY', params: { field: 'date' } }]);
    }
    const dir = q.sort === 'asc' ? 'ASC' : 'DESC';
    const qb = this.ds.getRepository(OrderEntity).createQueryBuilder('o')
      .innerJoinAndSelect('o.createdBy', 'staff')
      .leftJoinAndSelect('o.transactions', 'pt', 'pt.status = :succeeded', { succeeded: 'SUCCEEDED' })
      .where('o.businessDate = :date', { date });
    if (q.status) qb.andWhere('o.status = :status', { status: q.status });
    if (q.method) qb.andWhere('pt.method = :method', { method: q.method });
    const orders = await qb.orderBy('o.createdAt', dir).addOrderBy('o.orderNumber', dir).getMany();
    return { orders: orders.map(toOrderSummaryDto) };
  }

  async get(id: string): Promise<OrderDto> {
    // Checked first: Postgres would reject a malformed uuid with 22P02 (a 500).
    if (!UUID.test(id)) throw new NotFoundException();
    const order = await this.ds.getRepository(OrderEntity).findOne({
      where: { id },
      relations: { createdBy: true, voidedBy: true, discountPreset: true, lines: true, transactions: true },
    });
    if (!order) throw new NotFoundException();
    return toOrderDto(order);
  }

  /** POST /orders/:id/void. Only a PENDING_PAYMENT order can be voided (R§10.2). */
  async void(staffId: string, id: string, dto: VoidOrderDto): Promise<OrderDto> {
    // Pure input check, so it runs before the lock: a bad request never touches a row.
    const checked = checkVoid(dto.reasonCode, dto.note);
    if (!checked.ok) throw new ApiException(400, 'VALIDATION_FAILED', checked.errors);
    const { reasonCode, note } = checked.unwrap();

    await this.ds.transaction(async (em) => {
      // Same row lock as payment: whichever of void/pay locks first wins, the other re-reads the new status.
      const order = await lockOrder(em, id);
      if (order.status !== 'PENDING_PAYMENT') throw new ApiException(409, 'VOID_NOT_ALLOWED');
      await em.update(PaymentTransactionEntity, { orderId: order.id, status: 'PENDING' }, { status: 'EXPIRED' });
      await em.update(OrderEntity, { id: order.id }, {
        status: 'VOIDED',
        voidedAt: this.clock.now(),
        voidedByStaffId: staffId,
        voidReasonCode: reasonCode,
        voidReasonNote: note,
      });
    });
    return this.get(id);
  }
}
