import { Menu } from '../src/menu/menu';
import { Result } from '../src/result';
import { SEED_MENU } from './fixtures';

const menu = Menu.fromItems(SEED_MENU);
it('finds items by code', () => expect(menu.get('VANILLA')?.price.toString()).toBe('10.00'));
it('returns undefined for unknown codes', () => expect(menu.get('HAZELNUT')).toBeUndefined());
it('drops inactive items', () => expect(Menu.fromItems(SEED_MENU.map(i => i.code === 'TEA' ? { ...i, isActive: false } : i)).get('TEA')).toBeUndefined());
it('lists a category in sortOrder', () => expect(menu.byCategory('SYRUP').map(i => i.code)).toEqual(['VANILLA', 'CARAMEL', 'CHOCOLATE']));
it('unwrap throws on errors', () => expect(() => Result.err([{ code: 'BASE_REQUIRED' }]).unwrap()).toThrow());
it('unwrap returns the value when ok', () => expect(Result.ok(5).unwrap()).toBe(5));
it('seed has 23 items', () => expect(SEED_MENU).toHaveLength(23));
it('lists the base drinks in sortOrder', () => expect(menu.byCategory('BASE').map(i => i.code)).toEqual(['COFFEE', 'TEA', 'MILK', 'LATTE', 'AMERICANO', 'ESPRESSO', 'CAPPUCCINO', 'MOCHA', 'THAI_TEA', 'LEMON_TEA', 'MATCHA_LATTE', 'COCOA']));
