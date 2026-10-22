import { useEffect, useId, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { X } from 'lucide-react';
import { ADDON_CATEGORIES, DEFAULT_LIMITS, describe, type Lang, type Menu, type MenuItem } from '@coffee/domain';
import { MenuImage } from '../../components/MenuImage';
import { Stepper } from '../../components/Stepper';
import type { DraftLine, DrinkDraft } from './useDrinkDraft';

interface Props {
  menu: Menu;
  draft: DrinkDraft;
  lang: Lang;
  onAdd(line: DraftLine): void;
  onClose(): void;
}

const tag = 'rounded px-1.5 py-0.5 text-xs font-semibold';
const focus = 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent';

/**
 * After Add the modal is gone at once, so the second click of a double click would hit the
 * page behind (a menu card, the cart's buttons). Swallow repeat clicks (`detail > 1`) until the
 * next fresh click, which removes the listener and goes through normally.
 */
function swallowRepeatClicks() {
  const onClick = (e: MouseEvent) => {
    if (e.detail > 1) {
      e.stopPropagation();
      e.preventDefault();
      return;
    }
    window.removeEventListener('click', onClick, true);
  };
  window.addEventListener('click', onClick, true);
}

/**
 * Native modal <dialog> for the picked base. Mounted only while `draft.base` is set.
 * Every exit (✕, Esc, backdrop, Add) goes through `dialog.close()`, so the browser restores
 * focus to the card; the dialog's `close` event then calls `onClose` (which resets the draft
 * and unmounts this component).
 */
export function CustomizeDialog({ menu, draft, lang, onAdd, onClose }: Props) {
  const { t } = useTranslation('drink-builder');
  const ref = useRef<HTMLDialogElement>(null);
  const added = useRef(false);
  // False until a fresh click (detail <= 1) happens inside the dialog. Until then a repeat
  // click is the rest of the double click that opened it, landing on the backdrop or a control.
  const armed = useRef(false);
  const titleId = useId();

  useEffect(() => {
    // No cleanup: closing here would fire `close` (and reset the draft) under StrictMode's re-run.
    const d = ref.current;
    if (d && !d.open) d.showModal();
  }, []);

  // Every user close (✕, backdrop, Add) removes the modal at once, so guard the rest of a double click.
  const close = () => {
    swallowRepeatClicks();
    ref.current?.close();
  };
  const name = (i: MenuItem) => (lang === 'th' ? i.nameTh : i.nameEn);
  const base = draft.base ? menu.get(draft.base) : undefined;
  const { result } = draft;
  const beverage = result.ok ? result.unwrap() : undefined;

  const add = () => {
    if (added.current || !result.ok) return;
    added.current = true;
    onAdd(draft.toLineInput());
    close();
  };

  return (
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      onClose={onClose}
      onClickCapture={(e) => {
        if (e.detail > 1 && !armed.current) {
          e.stopPropagation();
          e.preventDefault();
          return;
        }
        armed.current = true;
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) close();
      }}
      className="m-auto max-h-[calc(100dvh-2rem)] w-[min(440px,92vw)] flex-col overflow-hidden rounded-2xl bg-surface p-0 text-espresso shadow-card open:flex backdrop:bg-espresso/45"
    >
      <div className="relative shrink-0">
        {draft.base && <MenuImage key={draft.base} code={draft.base} alt="" className="h-36 w-full" />}
        <button
          type="button"
          aria-label={t('close')}
          onClick={close}
          className={`absolute right-3 top-3 flex size-8 items-center justify-center rounded-full bg-surface/90 text-espresso shadow-card hover:bg-surface ${focus}`}
        >
          <X aria-hidden="true" className="size-4" />
        </button>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-5 pb-4 pt-4">
        <div className="flex items-baseline justify-between gap-3">
          <h2 id={titleId} className="min-w-0 break-words text-lg font-semibold">
            {base ? name(base) : draft.base}
          </h2>
          {base && <span className="shrink-0 text-sm text-muted">{t('from', { price: base.price.format() })}</span>}
        </div>

        <section className="mt-4">
          <div className="mb-2 flex items-center justify-between gap-3">
            <h3 className="font-semibold">{t('size')}</h3>
            <span className={`${tag} bg-accent-soft text-accent-ink`}>{t('pickOne')}</span>
          </div>
          <div className="grid grid-cols-3 gap-2">
            {menu.byCategory('SIZE').map((i) => {
              const on = draft.size === i.code;
              return (
                <button
                  key={i.code}
                  type="button"
                  aria-pressed={on}
                  onClick={() => draft.setSize(i.code)}
                  className={`flex flex-col items-center rounded-xl border-2 px-2 py-2 text-sm ${focus} ${
                    on ? 'border-accent bg-accent-soft font-semibold text-accent-ink' : 'border-line hover:border-accent/40'
                  }`}
                >
                  <span className="break-words">{name(i)}</span>{' '}
                  <span className={`text-xs ${on ? 'text-accent-ink' : 'text-muted'}`}>+{i.price.format()}</span>
                </button>
              );
            })}
          </div>
        </section>

        <section className="mt-5">
          <div className="mb-1 flex items-center justify-between gap-3">
            <h3 className="font-semibold">{t('addOns')}</h3>
            <span className={`${tag} bg-cream text-muted`}>
              {t('optional', { count: draft.addOnTotal, max: DEFAULT_LIMITS.maxAddOns })}
            </span>
          </div>
          <p className="text-xs text-muted">{t('limitAddOns', { max: DEFAULT_LIMITS.maxAddOns })}</p>
          <p className="text-xs text-muted">{t('limitSameAddOn', { max: DEFAULT_LIMITS.maxSameAddOn })}</p>
          {ADDON_CATEGORIES.map((cat) => (
            <div key={cat} className="mt-3">
              <h4 className="text-sm font-semibold">{t(`category.${cat}`)}</h4>
              <ul>
                {menu.byCategory(cat).map((i) => {
                  const count = draft.addOns[i.code] ?? 0;
                  return (
                    <li key={i.code} className="flex items-center gap-3 border-b border-line py-2 last:border-b-0">
                      <span className="min-w-0 flex-1 break-words text-sm">{name(i)}</span>
                      <span className="text-sm text-muted">+{i.price.format()}</span>
                      <Stepper
                        value={count}
                        decreaseLabel={t('decrease', { name: name(i) })}
                        increaseLabel={t('increase', { name: name(i) })}
                        countLabel={t('count', { name: name(i) })}
                        canDecrease={count > 0}
                        canIncrease={draft.canIncrement(i.code)}
                        onDecrease={() => draft.decrement(i.code)}
                        onIncrease={() => draft.increment(i.code)}
                      />
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </section>
      </div>

      <div className="flex shrink-0 items-center gap-3 border-t border-line px-5 py-3">
        <p data-testid="description" className="min-w-0 flex-1 break-words text-sm font-semibold">
          {beverage ? describe(beverage, lang) : <span className="font-normal text-muted">{t('incomplete')}</span>}
        </p>
        <button
          type="button"
          disabled={!result.ok}
          onClick={add}
          className={`shrink-0 rounded-xl bg-accent px-4 py-2.5 text-sm font-semibold text-white enabled:hover:bg-accent-ink focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:bg-line disabled:text-muted ${focus}`}
        >
          {t('addToCart')}
          <span aria-hidden="true" data-testid="price">
            {beverage ? ` · ${beverage.cost().format()}` : ''}
          </span>
        </button>
      </div>
    </dialog>
  );
}
