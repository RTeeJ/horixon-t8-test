import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useLocation } from 'react-router-dom';
import i18n from '../i18n';
import { App } from '../App';
import { renderWithProviders } from '../test/render';

const row = (o: object) => ({
  id: 'o1',
  orderNumber: '20261022-0001',
  status: 'PENDING_PAYMENT',
  createdAt: '2026-10-22T03:15:00.000Z',
  createdBy: { id: 1, displayName: 'Cashier One' },
  total: '200.00',
  paymentMethod: null,
  ...o,
});

const json = (body: unknown) =>
  new Response(JSON.stringify(body), { status: 200, headers: { 'Content-Type': 'application/json' } });

function Probe() {
  const loc = useLocation();
  return <output data-testid="loc">{loc.pathname + loc.search}</output>;
}

function setup(orders: unknown[], route = '/orders') {
  localStorage.setItem(
    'pos.auth',
    JSON.stringify({ accessToken: 'tok', staff: { id: 1, displayName: 'Cashier One' }, appEnv: 'dev' }),
  );
  const fetchStub = vi.fn().mockImplementation(async () => json({ orders }));
  vi.stubGlobal('fetch', fetchStub);
  renderWithProviders(
    <>
      <App />
      <Probe />
    </>,
    { route },
  );
  return { fetchStub, user: userEvent.setup() };
}

const urls = (f: ReturnType<typeof vi.fn>) => f.mock.calls.map((c) => String(c[0]));

describe('OrdersPage', () => {
  beforeEach(async () => {
    await i18n.changeLanguage('en');
    vi.useFakeTimers({ shouldAdvanceTime: true });
    vi.setSystemTime(new Date('2026-10-21T17:30:00Z'));
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('defaults to today in Bangkok', async () => {
    const { fetchStub } = setup([]);
    await screen.findByText('No orders match these filters.');
    expect(urls(fetchStub).some((u) => u.endsWith('/orders?date=2026-10-22&sort=desc'))).toBe(true);
    expect(screen.getByLabelText('Date')).toHaveDisplayValue('Today');
  });

  it('filters refetch and stay in the URL', async () => {
    const { fetchStub, user } = setup([]);
    await screen.findByText('No orders match these filters.');
    await user.selectOptions(screen.getByLabelText('Status'), 'PAID');
    await screen.findByText('No orders match these filters.');
    expect(urls(fetchStub).some((u) => u.includes('status=PAID'))).toBe(true);
    expect(screen.getByTestId('loc').textContent).toContain('status=PAID');
  });

  it('rows show actions by status', async () => {
    setup([
      row({}),
      row({ id: 'o2', orderNumber: '20261022-0002', status: 'PAID', paymentMethod: 'CASH' }),
    ]);
    const pay = await screen.findByRole('link', { name: 'Pay' });
    expect(pay).toHaveAttribute('href', '/orders/o1/pay');
    const receipt = screen.getByRole('link', { name: 'Receipt' });
    expect(receipt).toHaveAttribute('href', '/orders/o2/receipt');
    const paidRow = screen.getByText('20261022-0002').closest('tr') as HTMLElement;
    expect(within(paidRow).getByText('Paid')).toBeInTheDocument();
    expect(within(paidRow).getByText('Cash')).toBeInTheDocument();
    expect(within(paidRow).getByText('10:15')).toBeInTheDocument();
    expect(within(paidRow).getByText('฿200.00')).toBeInTheDocument();
  });

  it('falls back to defaults for invalid URL filters', async () => {
    const { fetchStub } = setup([], '/orders?date=2020-01-01&status=BOGUS&sort=zzz');
    await screen.findByText('No orders match these filters.');
    expect(urls(fetchStub).every((u) => u.endsWith('/orders?date=2026-10-22&sort=desc'))).toBe(true);
    expect(screen.queryByRole('alert')).toBeNull();
  });

  // NONE transactions only come from free orders, which are deferred, so the filter would always be empty.
  it('payment method filter offers only QR and cash', async () => {
    setup([]);
    await screen.findByText('No orders match these filters.');
    const options = within(screen.getByLabelText('Payment method')).getAllByRole('option');
    expect(options.map((o) => o.textContent)).toEqual(['All', 'QR', 'Cash']);
  });

  it('ignores method=NONE in the URL', async () => {
    const { fetchStub } = setup([], '/orders?method=NONE');
    await screen.findByText('No orders match these filters.');
    expect(urls(fetchStub).every((u) => !u.includes('method='))).toBe(true);
    expect(screen.getByLabelText('Payment method')).toHaveDisplayValue('All');
  });

  it('empty state', async () => {
    setup([]);
    expect(await screen.findByText('No orders match these filters.')).toBeInTheDocument();
  });

  it('header links to Orders', async () => {
    const { user } = setup([], '/');
    const link = await screen.findByRole('link', { name: 'Orders' });
    expect(link).toHaveAttribute('href', '/orders');
    await user.click(link);
    expect(await screen.findByRole('link', { name: 'Orders' })).toHaveAttribute('aria-current', 'page');
    expect(screen.getByRole('link', { name: 'New order' })).toHaveAttribute('href', '/');
  });
});
