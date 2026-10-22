import { useState, type FormEvent } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { Coffee } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { ApiError } from '../api/client';
import { useAuth } from '../auth/AuthContext';
import type { ErrorCode } from '@coffee/domain';
import { LanguageSwitch } from '../components/LanguageSwitch';
import heroUrl from '../assets/login-hero.jpg';
import { errorMessage } from '../i18n/error-message';

// The seeded demo staff (requirements §12). Shown only in dev builds or when the
// build sets VITE_DEMO_LOGIN=true (docker-compose does). The check stays inline in
// the JSX so Vite folds it to `false` and drops these credentials from a plain prod build.
const DEMO_PASSWORD = 'password123';
const DEMO_ACCOUNTS = [
  { username: 'cashier1', displayName: 'Cashier 1' },
  { username: 'cashier2', displayName: 'Cashier 2' },
];

export function LoginPage() {
  const { t } = useTranslation(['auth', 'common', 'button', 'error-message-code']);
  const { staff, login } = useAuth();
  const navigate = useNavigate();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [pending, setPending] = useState(false);
  const [errorCode, setErrorCode] = useState<ErrorCode | null>(null);

  if (staff) return <Navigate to="/" replace />;

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setPending(true);
    setErrorCode(null);
    try {
      await login(username, password);
      navigate('/', { replace: true });
    } catch (err) {
      setErrorCode(err instanceof ApiError ? err.code : 'INTERNAL');
      setPending(false);
    }
  }

  const input =
    'mt-1 w-full rounded-lg border border-line bg-surface px-3 py-2 text-base outline-none focus:border-accent focus-visible:ring-2 focus-visible:ring-accent';
  return (
    <div className="relative grid min-h-screen lg:grid-cols-2">
      <div className="relative hidden flex-col justify-end overflow-hidden p-12 text-white lg:flex">
        <img src={heroUrl} alt="" className="absolute inset-0 size-full object-cover" />
        <div className="absolute inset-0 bg-gradient-to-t from-espresso/75 to-espresso/10" />
        <div className="relative">
          <div className="flex items-center gap-2 text-2xl font-bold">
            <Coffee aria-hidden="true" className="size-7" />
            {t('common:app.title')}
          </div>
          <p className="mt-1 text-lg opacity-90">{t('common:login.tagline')}</p>
        </div>
      </div>
      <main className="flex items-center justify-center p-8">
        <div className="w-full max-w-sm">
          <span className="mb-3 inline-flex size-10 items-center justify-center rounded-xl bg-espresso text-white">
            <Coffee aria-hidden="true" className="size-5" />
          </span>
          <h1 className="text-2xl font-bold">{t('auth:title')}</h1>
          <p className="text-sm text-muted">{t('auth:subtitle')}</p>
          <form onSubmit={onSubmit} className="mt-6 grid gap-4">
            <label className="block text-sm font-medium">
              {t('auth:username')}
              <input className={input} value={username} onChange={(e) => setUsername(e.target.value)} autoComplete="username" required />
            </label>
            <label className="block text-sm font-medium">
              {t('auth:password')}
              <input
                className={input}
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
                required
              />
            </label>
            {errorCode && (
              <p role="alert" className="text-sm text-danger">
                {errorMessage(t, errorCode)}
              </p>
            )}
            <button
              type="submit"
              disabled={pending}
              className="w-full rounded-xl bg-accent px-4 py-2.5 font-bold text-white hover:bg-accent-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 disabled:opacity-60"
            >
              {pending ? t('button:signingIn') : t('button:signIn')}
            </button>
          </form>
          {(import.meta.env.DEV || import.meta.env.VITE_DEMO_LOGIN === 'true') && (
            <div
              role="group"
              aria-labelledby="demo-accounts-title"
              className="mt-6 rounded-xl border border-dashed border-line p-4"
            >
              <p id="demo-accounts-title" className="text-sm font-semibold">
                {t('auth:demo.title')}
              </p>
              <p className="text-xs text-muted">{t('auth:demo.hint')}</p>
              <div className="mt-3 flex flex-wrap gap-2">
                {DEMO_ACCOUNTS.map((a) => (
                  <button
                    key={a.username}
                    type="button"
                    onClick={() => {
                      setUsername(a.username);
                      setPassword(DEMO_PASSWORD);
                      setErrorCode(null);
                    }}
                    className="rounded-full border border-line bg-surface px-3 py-1 text-sm font-medium hover:border-accent hover:text-accent-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                  >
                    {a.displayName}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </main>
      <LanguageSwitch className="absolute right-4 top-4 !bg-espresso/10 text-espresso" />
    </div>
  );
}
