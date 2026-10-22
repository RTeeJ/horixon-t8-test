import { Plus } from 'lucide-react';
import type { Lang, Menu } from '@coffee/domain';
import { MenuImage } from '../../components/MenuImage';

interface Props {
  menu: Menu;
  lang: Lang;
  onPick(code: string): void;
}

/**
 * Four columns on a desktop window (S§4.3; 12 cards in three rows). Narrower windows fall back to
 * as many ≥160px columns as fit, so cards are not squeezed at 1024px (three columns there).
 */
export const MENU_GRID = 'grid gap-4 grid-cols-[repeat(auto-fill,minmax(160px,1fr))] xl:grid-cols-4';

/**
 * One photo card per base drink. The card's accessible name is its text: current-language
 * name, other-language name, price (e.g. "Coffee กาแฟ ฿50.00"), so the photo has an empty alt.
 * The `{' '}` text nodes keep the words apart in the name; they do not show in the column layout.
 */
export function MenuGrid({ menu, lang, onPick }: Props) {
  return (
    <div className={MENU_GRID}>
      {menu.byCategory('BASE').map((i) => {
        const [main, other] = lang === 'th' ? [i.nameTh, i.nameEn] : [i.nameEn, i.nameTh];
        return (
          <button
            key={i.code}
            type="button"
            onClick={(e) => {
              // The rest of a double click: the dialog is already opening.
              if (e.detail > 1) return;
              onPick(i.code);
            }}
            className="relative flex flex-col overflow-hidden rounded-2xl bg-surface text-left shadow-card transition-transform hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
          >
            <MenuImage key={i.code} code={i.code} alt="" className="aspect-square w-full" />
            <span className="flex flex-col gap-0.5 p-3 pr-12">
              <span className="font-semibold leading-tight break-words">{main}</span>{' '}
              <span className="text-xs text-muted break-words">{other}</span>{' '}
              <span className="mt-1 font-bold text-accent">{i.price.format()}</span>
            </span>
            <span
              aria-hidden="true"
              className="absolute bottom-3 right-3 flex size-8 items-center justify-center rounded-full bg-accent text-white"
            >
              <Plus className="size-4" />
            </span>
          </button>
        );
      })}
    </div>
  );
}
