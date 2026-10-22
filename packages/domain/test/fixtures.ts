import type { MenuItemData } from '../src/menu/menu';
import type { DiscountPreset } from '../src/discount/preset';

const row = (
  id: string, code: string, category: MenuItemData['category'], nameEn: string, nameTh: string, price: string, sortOrder: number,
): MenuItemData => ({ id: `menu-${id}`, code, category, nameEn, nameTh, price, isActive: true, sortOrder });

/** The 23 seed rows of requirements §4.1; sortOrder = row order within category. */
export const SEED_MENU: MenuItemData[] = [
  row('coffee', 'COFFEE', 'BASE', 'Coffee', 'กาแฟ', '50.00', 1),
  row('tea', 'TEA', 'BASE', 'Tea', 'ชา', '40.00', 2),
  row('milk', 'MILK', 'BASE', 'Milk', 'นม', '35.00', 3),
  row('latte', 'LATTE', 'BASE', 'Latte', 'ลาเต้', '60.00', 4),
  row('americano', 'AMERICANO', 'BASE', 'Americano', 'อเมริกาโน่', '55.00', 5),
  row('espresso', 'ESPRESSO', 'BASE', 'Espresso', 'เอสเปรสโซ่', '45.00', 6),
  row('cappuccino', 'CAPPUCCINO', 'BASE', 'Cappuccino', 'คาปูชิโน่', '60.00', 7),
  row('mocha', 'MOCHA', 'BASE', 'Mocha', 'มอคค่า', '65.00', 8),
  row('thai-tea', 'THAI_TEA', 'BASE', 'Thai Tea', 'ชาไทย', '45.00', 9),
  row('lemon-tea', 'LEMON_TEA', 'BASE', 'Lemon Tea', 'ชามะนาว', '40.00', 10),
  row('matcha-latte', 'MATCHA_LATTE', 'BASE', 'Matcha Latte', 'มัทฉะลาเต้', '65.00', 11),
  row('cocoa', 'COCOA', 'BASE', 'Cocoa', 'โกโก้', '45.00', 12),
  row('size-small', 'SIZE_SMALL', 'SIZE', 'Small', 'แก้วเล็ก', '0.00', 1),
  row('size-medium', 'SIZE_MEDIUM', 'SIZE', 'Medium', 'แก้วกลาง', '15.00', 2),
  row('size-large', 'SIZE_LARGE', 'SIZE', 'Large', 'แก้วใหญ่', '30.00', 3),
  row('extra-coffee-shot', 'EXTRA_COFFEE_SHOT', 'EXTRA', 'Extra Coffee Shot', 'เพิ่มช็อตกาแฟ', '20.00', 1),
  row('extra-milk', 'EXTRA_MILK', 'EXTRA', 'Extra Milk', 'เพิ่มนม', '10.00', 2),
  row('vanilla', 'VANILLA', 'SYRUP', 'Vanilla', 'วานิลลา', '10.00', 1),
  row('caramel', 'CARAMEL', 'SYRUP', 'Caramel', 'คาราเมล', '10.00', 2),
  row('chocolate', 'CHOCOLATE', 'SYRUP', 'Chocolate', 'ช็อกโกแลต', '10.00', 3),
  row('whipped-cream', 'WHIPPED_CREAM', 'TOPPING', 'Whipped Cream', 'วิปครีม', '15.00', 1),
  row('cinnamon', 'CINNAMON', 'TOPPING', 'Cinnamon', 'อบเชย', '5.00', 2),
  row('marshmallows', 'MARSHMALLOWS', 'TOPPING', 'Marshmallows', 'มาร์ชเมลโลว์', '10.00', 3),
];

/** The 3 seed presets of requirements §9.1. */
export const SEED_PRESETS: DiscountPreset[] = [
  { id: 'preset-staff-15', code: 'STAFF_15', nameEn: 'Staff discount 15%', nameTh: 'ส่วนลดพนักงาน 15%', type: 'PERCENT', value: '15.00', minSubtotal: null },
  { id: 'preset-promo-10', code: 'PROMO_10_PERCENT', nameEn: 'Promotion 10%', nameTh: 'โปรโมชัน ลด 10%', type: 'PERCENT', value: '10.00', minSubtotal: '100.00' },
  { id: 'preset-promo-30', code: 'PROMO_30_BAHT', nameEn: 'Promotion ฿30', nameTh: 'โปรโมชัน ลด ฿30', type: 'AMOUNT', value: '30.00', minSubtotal: '200.00' },
];
