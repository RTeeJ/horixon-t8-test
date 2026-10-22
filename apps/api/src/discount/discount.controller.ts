import { Controller, Get } from '@nestjs/common';
import { DiscountService } from './discount.service';

// Not @Public(): the global JWT guard applies, staff only.
@Controller('discount-presets')
export class DiscountController {
  constructor(private readonly discounts: DiscountService) {}

  @Get()
  async list() {
    return { presets: await this.discounts.loadPresets() };
  }
}
