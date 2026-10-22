import { useEffect, useId, useRef, useState } from 'react';
import { ChevronDown, LogOut } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { LanguageSwitch } from './LanguageSwitch';

interface Props {
  displayName: string;
  onLogout: () => void;
}

/** Name button in the header; opens a panel with the language switch and Log out (disclosure pattern). */
export function UserMenu({ displayName, onLogout }: Props) {
  const { t } = useTranslation(['common', 'button']);
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelId = useId();

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: PointerEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      setOpen(false);
      triggerRef.current?.focus();
    };
    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  return (
    <div ref={rootRef} className="relative">
      <button
        ref={triggerRef}
        type="button"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-2 rounded-lg py-1 pl-1 pr-2 text-sm hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
      >
        <span
          aria-hidden="true"
          className="flex size-7 items-center justify-center rounded-full bg-accent text-xs font-bold uppercase"
        >
          {displayName.charAt(0)}
        </span>
        {displayName}
        <ChevronDown aria-hidden="true" className={`size-4 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <div
          id={panelId}
          className="absolute right-0 top-full z-20 mt-2 w-60 rounded-xl border border-line bg-surface p-2 text-espresso shadow-card"
        >
          <p className="truncate px-2 py-1.5 text-xs text-muted">
            {t('common:header.signedInAs', { name: displayName })}
          </p>
          <div className="flex items-center justify-between gap-2 px-2 py-1.5">
            <span className="text-sm">{t('common:header.language')}</span>
            <LanguageSwitch className="!bg-espresso/10 text-espresso" />
          </div>
          <hr className="my-1 border-line" />
          <button
            type="button"
            onClick={onLogout}
            className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-sm hover:bg-accent-soft hover:text-accent-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
          >
            <LogOut aria-hidden="true" className="size-4" />
            {t('button:logout')}
          </button>
        </div>
      )}
    </div>
  );
}
