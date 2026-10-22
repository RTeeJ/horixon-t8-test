import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Menu, MenuItemData } from '@coffee/domain';
import { MenuItemEntity } from './menu-item.entity';

@Injectable()
export class MenuService {
  constructor(@InjectRepository(MenuItemEntity) private readonly repo: Repository<MenuItemEntity>) {}

  async loadMenu(): Promise<Menu> {
    const rows = await this.repo.find({ where: { isActive: true } });
    const data: MenuItemData[] = rows.map((r) => ({
      id: r.id, code: r.code, category: r.category, nameEn: r.nameEn, nameTh: r.nameTh,
      price: r.price.toString(), isActive: r.isActive, sortOrder: r.sortOrder,
    }));
    return Menu.fromItems(data);
  }
}
