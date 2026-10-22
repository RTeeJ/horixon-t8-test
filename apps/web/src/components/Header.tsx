import { Coffee } from 'lucide-react';
import { NavLink } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../auth/AuthContext';
import { LanguageSwitch } from './LanguageSwitch';
import { UserMenu } from './UserMenu';

export function Header() {
  const { t } = useTranslation(['common', 'button']);
  const { staff, appEnv, logout } = useAuth();
  return (
    <header className="print:hidden sticky top-0 z-10 flex h-14 items-center gap-3 bg-espresso px-6 text-white">
      <Coffee aria-hidden="true" className="size-5" />
      <strong className="text-base font-semibold">{t('common:app.title')}</strong>
      {appEnv && (
        <span className="rounded bg-amber-400 px-2 py-0.5 text-xs font-bold text-espresso">
          {t(`common:env.${appEnv}`)}
        </span>
      )}
      <nav aria-label={t('common:nav.label')} className="ml-4 flex gap-1">
        {[
          { to: '/', key: 'newOrder' },
          { to: '/orders', key: 'orders' },
        ].map((l) => (
          <NavLink
            key={l.to}
            to={l.to}
            end
            className={({ isActive }) =>
              `rounded-lg px-3 py-1.5 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent ${
                isActive ? 'bg-white/15 font-semibold text-white' : 'text-white/85 hover:bg-white/10 hover:text-white'
              }`
            }
          >
            {t(`common:nav.${l.key}`)}
          </NavLink>
        ))}
      </nav>
      <span className="flex-1" />
      {staff ? <UserMenu displayName={staff.displayName} onLogout={logout} /> : <LanguageSwitch />}
    </header>
  );
}
