import { Controller, Get } from '@nestjs/common';
import { Category } from '@coffee/domain';
import { Public } from '../auth/public.decorator';
import { MenuService } from './menu.service';

const CATEGORY_ORDER: Category[] = ['BASE', 'SIZE', 'EXTRA', 'SYRUP', 'TOPPING'];

@Public()
@Controller('menu')
export class MenuController {
  constructor(private readonly menu: MenuService) {}

  @Get()
  async list() {
    const menu = await this.menu.loadMenu();
    const items = CATEGORY_ORDER.flatMap((c) => menu.byCategory(c)).map((i) => ({
      id: i.id, code: i.code, category: i.category, nameEn: i.nameEn, nameTh: i.nameTh,
      price: i.price.toString(), sortOrder: i.sortOrder,
    }));
    return { items };
  }
}
