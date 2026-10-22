import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import i18n from '../i18n';
import { App } from '../App';
import { renderWithProviders } from '../test/render';

function renderSignedIn() {
  localStorage.setItem(
    'pos.auth',
    JSON.stringify({ accessToken: 'tok', staff: { id: 1, displayName: 'Cashier One' }, appEnv: 'dev' }),
  );
  vi.stubGlobal(
    'fetch',
    vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ items: [] }), { status: 200, headers: { 'Content-Type': 'application/json' } }),
    ),
  );
  renderWithProviders(<App />, { route: '/' });
  return { user: userEvent.setup(), trigger: screen.getByRole('button', { name: 'Cashier One' }) };
}

describe('UserMenu', () => {
  beforeEach(async () => {
    await i18n.changeLanguage('en');
  });

  it('keeps language and log out behind the name button', async () => {
    const { user, trigger } = renderSignedIn();
    expect(trigger).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByRole('button', { name: 'Log out' })).not.toBeInTheDocument();
    expect(screen.queryByRole('group', { name: 'Language' })).not.toBeInTheDocument();

    await user.click(trigger);
    expect(trigger).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByText('Signed in as Cashier One')).toBeInTheDocument();
    expect(screen.getByRole('group', { name: 'Language' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Log out' })).toBeInTheDocument();
  });

  it('switches language and stays open', async () => {
    const { user, trigger } = renderSignedIn();
    await user.click(trigger);
    await user.click(screen.getByRole('button', { name: 'ไทย' }));
    expect(screen.getByRole('button', { name: 'ไทย' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: 'ออกจากระบบ' })).toBeInTheDocument();
    expect(localStorage.getItem('pos.lang')).toBe('th');
  });

  it('closes on Escape and returns focus to the button', async () => {
    const { user, trigger } = renderSignedIn();
    await user.click(trigger);
    await user.keyboard('{Escape}');
    expect(trigger).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByRole('button', { name: 'Log out' })).not.toBeInTheDocument();
    expect(trigger).toHaveFocus();
  });

  it('closes on a click outside', async () => {
    const { user, trigger } = renderSignedIn();
    await user.click(trigger);
    await user.click(screen.getByRole('heading', { name: 'Drinks' }));
    expect(trigger).toHaveAttribute('aria-expanded', 'false');
  });

  it('logs out to the sign-in page', async () => {
    const { user, trigger } = renderSignedIn();
    await user.click(trigger);
    await user.click(screen.getByRole('button', { name: 'Log out' }));
    expect(await screen.findByRole('heading', { name: 'Staff sign in' })).toBeInTheDocument();
    expect(localStorage.getItem('pos.auth')).toBeNull();
  });
});
