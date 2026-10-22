import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import i18n from '../i18n';
import { App } from '../App';
import { renderWithProviders } from '../test/render';

function jsonResponse(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

async function fillAndSubmit() {
  const user = userEvent.setup();
  await user.type(screen.getByLabelText('Username'), 'cashier1');
  await user.type(screen.getByLabelText('Password'), 'password123');
  await user.click(screen.getByRole('button', { name: 'Sign in' }));
  return user;
}

describe('LoginPage', () => {
  beforeEach(async () => {
    await i18n.changeLanguage('en');
  });

  it('switches the login page to Thai', async () => {
    renderWithProviders(<App />, { route: '/login' });
    expect(screen.queryByRole('banner')).toBeNull();
    expect(screen.getAllByRole('group', { name: 'Language' })).toHaveLength(1);
    await userEvent.setup().click(screen.getByRole('button', { name: 'ไทย' }));
    expect(await screen.findByRole('heading', { name: 'พนักงานเข้าสู่ระบบ' })).toBeInTheDocument();
    expect(localStorage.getItem('pos.lang')).toBe('th');
  });

  it('navigates to / after a successful login', async () => {
    const fetchStub = vi.fn().mockImplementation(async (url: string) =>
      String(url).endsWith('/menu')
        ? jsonResponse(200, { items: [] })
        : jsonResponse(200, {
            accessToken: 'tok',
            staff: { id: 1, displayName: 'Cashier One' },
            appEnv: 'dev',
          }),
    );
    vi.stubGlobal('fetch', fetchStub);
    renderWithProviders(<App />, { route: '/login' });
    await fillAndSubmit();
    expect(await screen.findByRole('heading', { name: 'New order' })).toBeInTheDocument();
    expect(fetchStub.mock.calls[0][0]).toMatch(/\/auth\/login$/);
    expect(JSON.parse(localStorage.getItem('pos.auth')!).accessToken).toBe('tok');
  });

  it('shows the English message for INVALID_CREDENTIALS, then Thai after switching', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(jsonResponse(401, { error: { code: 'INVALID_CREDENTIALS' } })),
    );
    renderWithProviders(<App />, { route: '/login' });
    const user = await fillAndSubmit();
    expect(await screen.findByRole('alert')).toHaveTextContent('Incorrect username or password.');
    await user.click(screen.getByRole('button', { name: 'ไทย' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง');
    expect(localStorage.getItem('pos.lang')).toBe('th');
  });

  it('disables the submit button while the request is pending', async () => {
    let resolve!: (r: Response) => void;
    vi.stubGlobal('fetch', vi.fn().mockReturnValue(new Promise<Response>((r) => (resolve = r))));
    renderWithProviders(<App />, { route: '/login' });
    await fillAndSubmit();
    expect(screen.getByRole('button', { name: 'Signing in…' })).toBeDisabled();
    resolve(jsonResponse(401, { error: { code: 'INVALID_CREDENTIALS' } }));
    await waitFor(() => expect(screen.getByRole('button', { name: 'Sign in' })).toBeEnabled());
  });

  describe('demo accounts', () => {
    afterEach(() => vi.unstubAllEnvs());

    it('fills the form for a demo account without signing in', async () => {
      vi.stubEnv('DEV', false);
      vi.stubEnv('VITE_DEMO_LOGIN', 'true');
      const fetchStub = vi.fn();
      vi.stubGlobal('fetch', fetchStub);
      renderWithProviders(<App />, { route: '/login' });
      const user = userEvent.setup();
      await user.click(screen.getByRole('button', { name: 'Cashier 2' }));
      expect(screen.getByLabelText('Username')).toHaveValue('cashier2');
      expect(screen.getByLabelText('Password')).toHaveValue('password123');
      expect(fetchStub).not.toHaveBeenCalled();
    });

    it('is shown in dev builds without the flag', () => {
      vi.stubEnv('DEV', true);
      vi.stubEnv('VITE_DEMO_LOGIN', '');
      renderWithProviders(<App />, { route: '/login' });
      expect(screen.getByRole('group', { name: 'Demo accounts' })).toBeInTheDocument();
    });

    it('is hidden in production builds without the flag', () => {
      vi.stubEnv('DEV', false);
      vi.stubEnv('VITE_DEMO_LOGIN', '');
      renderWithProviders(<App />, { route: '/login' });
      expect(screen.queryByRole('group', { name: 'Demo accounts' })).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: 'Cashier 1' })).not.toBeInTheDocument();
    });
  });

  it('falls back to the generic message for an unknown error code', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(jsonResponse(500, { error: { code: 'FOO' } })),
    );
    renderWithProviders(<App />, { route: '/login' });
    await fillAndSubmit();
    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('Something went wrong on our side. Please try again.');
    expect(alert).not.toHaveTextContent('FOO');
  });
});
