import { SEED_MENU } from '../../../../../packages/domain/test/fixtures';
import { FALLBACK_MENU_IMAGE, menuImage } from './menu-images';

describe('menuImage', () => {
  it('maps a code to its kebab-case jpg', () => {
    expect(menuImage('COFFEE')).toMatch(/coffee\.jpg$/);
    expect(menuImage('MATCHA_LATTE')).toMatch(/matcha-latte\.jpg$/);
  });

  it('has a photo for every BASE code in the seed menu', () => {
    const bases = SEED_MENU.filter((m) => m.category === 'BASE');
    expect(bases).toHaveLength(12);
    for (const { code } of bases) {
      expect(menuImage(code)).not.toBe(FALLBACK_MENU_IMAGE);
    }
  });

  it('falls back for codes without a photo', () => {
    expect(menuImage('HAZELNUT')).toBe(FALLBACK_MENU_IMAGE);
    expect(menuImage('SIZE_LARGE')).toBe(FALLBACK_MENU_IMAGE);
  });
});
