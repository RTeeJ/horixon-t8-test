import { useTranslation } from 'react-i18next';
import { setLang } from '../i18n';

export function LanguageSwitch({ className = '' }: { className?: string }) {
  const { t, i18n } = useTranslation(['common', 'button']);
  const lang = i18n.language;
  const base =
    'rounded-full px-3 py-1 text-xs font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent';
  const on = 'bg-accent text-white';
  const off = 'text-current opacity-80 hover:opacity-100';
  return (
    <div
      role="group"
      aria-label={t('common:header.language')}
      className={`inline-flex gap-0.5 rounded-full bg-white/15 p-0.5 ${className}`}
    >
      <button type="button" aria-pressed={lang === 'en'} onClick={() => setLang('en')} className={`${base} ${lang === 'en' ? on : off}`}>
        {t('button:english')}
      </button>
      <button type="button" aria-pressed={lang === 'th'} onClick={() => setLang('th')} className={`${base} ${lang === 'th' ? on : off}`}>
        {t('button:thai')}
      </button>
    </div>
  );
}
