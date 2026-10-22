import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import type { DiscountPreset } from '@coffee/domain';
import { DiscountPresetEntity } from './discount-preset.entity';

@Injectable()
export class DiscountService {
  constructor(@InjectRepository(DiscountPresetEntity) private readonly repo: Repository<DiscountPresetEntity>) {}

  async loadPresets(): Promise<DiscountPreset[]> {
    const rows = await this.repo.find({ where: { isActive: true }, order: { sortOrder: 'ASC' } });
    return rows.map((r) => ({
      id: r.id, code: r.code, nameEn: r.nameEn, nameTh: r.nameTh,
      type: r.type, value: r.value, minSubtotal: r.minSubtotal,
    }));
  }
}
