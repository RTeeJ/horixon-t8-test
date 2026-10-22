import fallbackUrl from '../../assets/menu/fallback.svg';

const photos = import.meta.glob<string>('../../assets/menu/*.jpg', {
  eager: true,
  import: 'default',
});

export const FALLBACK_MENU_IMAGE: string = fallbackUrl;

const byFile = new Map<string, string>(
  Object.entries(photos).map(([path, url]) => [path.slice(path.lastIndexOf('/') + 1), url]),
);

/** Photo for a menu `code` (COFFEE -> coffee.jpg, THAI_TEA -> thai-tea.jpg), or the fallback. */
export function menuImage(code: string): string {
  return byFile.get(`${code.toLowerCase().replaceAll('_', '-')}.jpg`) ?? FALLBACK_MENU_IMAGE;
}
