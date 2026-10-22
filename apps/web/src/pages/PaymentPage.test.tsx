import { Profiler } from 'react';
import { act, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import i18n from '../i18n';
import { App } from '../App';
import { renderWithProviders } from '../test/render';

const order = {
  id: 'o1',
  orderNumber: '20261021-0001',
  status: 'PENDING_PAYMENT',
  createdAt: '2026-10-21T03:15:00.000Z',
  createdBy: { id: 1, displayName: 'Cashier One' },
  lines: [
    { quantity: 2, descriptionEn: 'Medium Tea', descriptionTh: 'ชา แก้วกลาง', unitPrice: '55.00', lineTotal: '110.00' },
    { quantity: 1, descriptionEn: 'Large Coffee, Vanilla', descriptionTh: 'กาแฟ แก้วใหญ่ วานิลลา', unitPrice: '90.00', lineTotal: '90.00' },
  ],
  subtotal: '200.00',
  total: '200.00',
  vatRateBps: 700,
  vat: '13.08',
  beforeVat: '186.92',
  discount: null,
  transactions: [],
  voided: null,
};
const paid = { ...order, status: 'PAID' };

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

function setup(opts: { order?: unknown; pay?: () => Response; flipToPaidAfterPay?: boolean } = {}) {
  localStorage.setItem(
    'pos.auth',
    JSON.stringify({ accessToken: 'tok', staff: { id: 1, displayName: 'Cashier One' }, appEnv: 'dev' }),
  );
  let payCalled = false;
  const fetchStub = vi.fn().mockImplementation(async (url: string, init?: RequestInit) => {
    if (String(url).endsWith('/payments') && init?.method === 'POST') {
      payCalled = true;
      return (opts.pay ?? (() => json(201, { transaction: {}, order: paid })))();
    }
    if (opts.flipToPaidAfterPay && payCalled) return json(200, paid);
    return json(200, opts.order ?? order);
  });
  vi.stubGlobal('fetch', fetchStub);
  renderWithProviders(<App />, { route: '/orders/o1/pay' });
  return { fetchStub, user: userEvent.setup() };
}

const paymentCalls = (f: ReturnType<typeof vi.fn>) =>
  f.mock.calls.filter((c) => String(c[0]).endsWith('/orders/o1/payments'));

describe('PaymentPage', () => {
  beforeEach(async () => {
    await i18n.changeLanguage('en');
  });

  it('shows the order number and total', async () => {
    setup();
    expect(await screen.findByText('20261021-0001')).toBeInTheDocument();
    expect(screen.getByText('฿200.00')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Pay later' })).toHaveAttribute('href', '/');
  });

  it('shows change for enough cash and enables Confirm', async () => {
    const { user } = setup();
    await user.type(await screen.findByLabelText('Cash received'), '250');
    expect(screen.getByText('Change ฿50.00')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Confirm cash' })).toBeEnabled();
  });

  it('shows CASH_INSUFFICIENT and keeps Confirm disabled', async () => {
    const { user } = setup();
    await user.type(await screen.findByLabelText('Cash received'), '150');
    expect(screen.getByText('Cash received is less than the order total.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Confirm cash' })).toBeDisabled();
  });

  it('shows CASH_AMOUNT_INVALID above the limit', async () => {
    const { user } = setup();
    await user.type(await screen.findByLabelText('Cash received'), '10000.01');
    expect(screen.getByText(/up to ฿10,000\.00/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Confirm cash' })).toBeDisabled();
  });

  it('sends the cash payment with an Idempotency-Key, then shows the receipt', async () => {
    const { fetchStub, user } = setup();
    await user.type(await screen.findByLabelText('Cash received'), '250');
    await user.click(screen.getByRole('button', { name: 'Confirm cash' }));
    expect(await screen.findByText('Paid')).toBeInTheDocument();
    const call = fetchStub.mock.calls.find((c) => String(c[0]).endsWith('/orders/o1/payments'))!;
    expect(call[1].method).toBe('POST');
    expect(JSON.parse(call[1].body)).toEqual({ method: 'CASH', cashReceived: '250.00' });
    expect(call[1].headers['Idempotency-Key']).toMatch(/^[0-9a-f-]{36}$/);
  });

  it('shows the ORDER_NOT_PAYABLE message on 409', async () => {
    const { user } = setup({ pay: () => json(409, { error: { code: 'ORDER_NOT_PAYABLE' } }) });
    await user.type(await screen.findByLabelText('Cash received'), '250');
    await user.click(screen.getByRole('button', { name: 'Confirm cash' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('This order can no longer be paid.');
  });

  it('on 409 ORDER_NOT_PAYABLE refetches the order and goes to the receipt once it is PAID', async () => {
    const { user } = setup({
      pay: () => json(409, { error: { code: 'ORDER_NOT_PAYABLE' } }),
      flipToPaidAfterPay: true,
    });
    await user.type(await screen.findByLabelText('Cash received'), '250');
    await user.click(screen.getByRole('button', { name: 'Confirm cash' }));
    expect(await screen.findByText('Paid')).toBeInTheDocument();
  });

  it('redirects a PAID order to the receipt', async () => {
    setup({ order: paid });
    expect(await screen.findByText('Paid')).toBeInTheDocument();
    expect(screen.queryByLabelText('Cash received')).not.toBeInTheDocument();
  });

  it('locks the amount input, Confirm and method tabs while the POST is pending', async () => {
    let release!: () => void;
    const { fetchStub, user } = setup({
      pay: () => new Promise<Response>((r) => (release = () => r(json(201, { transaction: {}, order: paid })))) as never,
    });
    const input = await screen.findByLabelText('Cash received');
    await user.type(input, '250');
    await user.click(screen.getByRole('button', { name: 'Confirm cash' }));
    expect(await screen.findByRole('button', { name: 'Confirming…' })).toBeDisabled();
    expect(input).toBeDisabled();
    expect(screen.getByRole('tab', { name: 'QR' })).toBeDisabled();
    release();
    expect(await screen.findByText('Paid')).toBeInTheDocument();
    expect(paymentCalls(fetchStub)).toHaveLength(1);
  });

  it('reuses the same Idempotency-Key when retrying after a network error', async () => {
    let n = 0;
    const { fetchStub, user } = setup({
      pay: () => {
        if (n++ === 0) throw new TypeError('network');
        return json(201, { transaction: {}, order: paid });
      },
    });
    await user.type(await screen.findByLabelText('Cash received'), '250');
    await user.click(screen.getByRole('button', { name: 'Confirm cash' }));
    expect(await screen.findByRole('alert')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Confirm cash' }));
    expect(await screen.findByText('Paid')).toBeInTheDocument();
    const keys = paymentCalls(fetchStub).map((c) => c[1].headers['Idempotency-Key']);
    expect(keys).toHaveLength(2);
    expect(keys[1]).toBe(keys[0]);
  });

  it('uses a different Idempotency-Key after the amount changes', async () => {
    let n = 0;
    const { fetchStub, user } = setup({
      pay: () =>
        n++ === 0
          ? json(400, { error: { code: 'VALIDATION_FAILED', details: [{ code: 'CASH_INSUFFICIENT' }] } })
          : json(201, { transaction: {}, order: paid }),
    });
    const input = await screen.findByLabelText('Cash received');
    await user.type(input, '250');
    await user.click(screen.getByRole('button', { name: 'Confirm cash' }));
    expect(await screen.findByRole('alert')).toBeInTheDocument();
    await user.clear(input);
    await user.type(input, '300');
    await user.click(screen.getByRole('button', { name: 'Confirm cash' }));
    expect(await screen.findByText('Paid')).toBeInTheDocument();
    const keys = paymentCalls(fetchStub).map((c) => c[1].headers['Idempotency-Key']);
    expect(keys).toHaveLength(2);
    expect(keys[1]).not.toBe(keys[0]);
  });
});

describe('PaymentPage QR', () => {
  const tx = (over: Record<string, unknown> = {}) => ({
    id: 't1',
    method: 'QR',
    amount: '200.00',
    status: 'PENDING',
    qrPayload: 'MOCKQR|o1|t1',
    cashReceived: null,
    change: null,
    createdAt: '2026-10-22T10:00:00.000Z',
    completedAt: null,
    expiresAt: '2026-10-22T10:05:00.000Z',
    ...over,
  });
  const started = () => json(201, { transaction: tx(), order });

  function setupQr(opts: { appEnv?: 'dev' | 'prod'; poll?: () => Response; confirm?: () => Response; onCommit?: () => void; settledOrder?: unknown } = {}) {
    localStorage.setItem(
      'pos.auth',
      JSON.stringify({ accessToken: 'tok', staff: { id: 1, displayName: 'Cashier One' }, appEnv: opts.appEnv ?? 'dev' }),
    );
    let settled = false; // once a response carries the PAID order, the order GET reflects it too
    const fetchStub = vi.fn().mockImplementation(async (url: string, init?: RequestInit) => {
      const u = String(url);
      if (u.endsWith('/mock-confirm') || (u.endsWith('/payments/t1') && opts.poll)) settled = true;
      if (u.endsWith('/orders/o1') && settled) return json(200, opts.settledOrder ?? paid);
      if (u.endsWith('/orders/o1/payments') && init?.method === 'POST') return started();
      if (u.endsWith('/payments/t1/mock-confirm')) {
        return (opts.confirm ?? (() => json(200, { transaction: tx({ status: 'SUCCEEDED' }), order: paid })))();
      }
      if (u.endsWith('/payments/t1')) return (opts.poll ?? (() => json(200, { transaction: tx(), order })))();
      return json(200, order);
    });
    vi.stubGlobal('fetch', fetchStub);
    renderWithProviders(
      <Profiler id="probe" onRender={() => opts.onCommit?.()}>
        <App />
      </Profiler>,
      { route: '/orders/o1/pay' },
    );
    return { fetchStub, user: userEvent.setup({ advanceTimers: vi.advanceTimersByTime }) };
  }

  const showQr = async (user: ReturnType<typeof userEvent.setup>) => {
    await user.click(await screen.findByRole('tab', { name: 'QR' }));
    await user.click(screen.getByRole('button', { name: 'Show QR code' }));
  };

  beforeEach(async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    vi.setSystemTime(new Date('2026-10-22T10:00:00.000Z'));
    await i18n.changeLanguage('en');
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('shows a QR with a countdown', async () => {
    const { fetchStub, user } = setupQr();
    await showQr(user);
    expect(await screen.findByText('5:00')).toBeInTheDocument();
    expect(document.querySelector('svg[role="img"], main svg')).not.toBeNull();
    const call = paymentCalls(fetchStub)[0]!;
    expect(JSON.parse(call[1].body)).toEqual({ method: 'QR' });
    expect(call[1].headers['Idempotency-Key']).toMatch(/^[0-9a-f-]{36}$/);
  });

  it('simulate is dev-only', async () => {
    const dev = setupQr({ appEnv: 'dev' });
    await showQr(dev.user);
    expect(await screen.findByRole('button', { name: 'Simulate customer paid' })).toBeInTheDocument();
  });

  it('hides simulate in prod', async () => {
    const { user } = setupQr({ appEnv: 'prod' });
    await showQr(user);
    await screen.findByText('5:00');
    expect(screen.queryByRole('button', { name: 'Simulate customer paid' })).not.toBeInTheDocument();
  });

  it('simulate pays and shows the receipt', async () => {
    const { fetchStub, user } = setupQr();
    await showQr(user);
    await user.click(await screen.findByRole('button', { name: 'Simulate customer paid' }));
    expect(await screen.findByText('Paid')).toBeInTheDocument();
    const call = fetchStub.mock.calls.find((c) => String(c[0]).endsWith('/payments/t1/mock-confirm'))!;
    expect(call[1].method).toBe('POST');
    expect(call[1].headers['Idempotency-Key']).toMatch(/^[0-9a-f-]{36}$/);
  });

  it("the server's expiry wins over the countdown, and New QR code uses a fresh key", async () => {
    const { fetchStub, user } = setupQr({ confirm: () => json(409, { error: { code: 'PAYMENT_EXPIRED' } }) });
    await showQr(user);
    await user.click(await screen.findByRole('button', { name: 'Simulate customer paid' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('This QR code has expired.');
    expect(screen.getByRole('button', { name: 'New QR code' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'New QR code' }));
    expect(await screen.findByText('5:00')).toBeInTheDocument();
    const keys = paymentCalls(fetchStub).map((c) => c[1].headers['Idempotency-Key']);
    expect(keys).toHaveLength(2);
    expect(keys[1]).not.toBe(keys[0]);
  });

  it('another terminal paid: a poll returning a PAID order shows the receipt', async () => {
    const { user } = setupQr({ poll: () => json(200, { transaction: tx({ status: 'SUCCEEDED' }), order: paid }) });
    await showQr(user);
    await vi.advanceTimersByTimeAsync(3100);
    expect(await screen.findByText('Paid')).toBeInTheDocument();
  });

  it('a poll saying EXPIRED shows the expired state', async () => {
    const { user } = setupQr({ poll: () => json(200, { transaction: tx({ status: 'EXPIRED' }), order }) });
    await showQr(user);
    await vi.advanceTimersByTimeAsync(3100);
    expect(await screen.findByRole('button', { name: 'New QR code' })).toBeInTheDocument();
  });

  it('a poll showing the order VOIDED leaves the payment screen for the receipt', async () => {
    const voided = { ...order, status: 'VOIDED', voided: { at: '2026-10-22T10:01:00.000Z', by: { id: '2', displayName: 'Cashier Two' }, reasonCode: 'OUT_OF_STOCK', note: null } };
    const { user } = setupQr({
      poll: () => json(200, { transaction: tx({ status: 'EXPIRED' }), order: voided }),
      settledOrder: voided,
    });
    await showQr(user);
    await vi.advanceTimersByTimeAsync(3100);
    expect(await screen.findByText('Voided')).toBeInTheDocument();
    expect(screen.queryByText('This QR code has expired.')).not.toBeInTheDocument();
  });

  it('never renders the expired message when a QR appears (also for a new QR)', async () => {
    const expiredText = 'This QR code has expired.';
    let expiredCommits = 0;
    const { user } = setupQr({
      confirm: () => json(409, { error: { code: 'PAYMENT_EXPIRED' } }),
      onCommit: () => {
        if (document.body.textContent?.includes(expiredText)) expiredCommits++;
      },
    });
    await user.click(await screen.findByRole('tab', { name: 'QR' }));
    await user.click(screen.getByRole('button', { name: 'Show QR code' }));
    expect(await screen.findByText('5:00')).toBeInTheDocument();
    expect(expiredCommits).toBe(0); // no commit between the POST resolving and the QR showing was "expired"
    await user.click(screen.getByRole('button', { name: 'Simulate customer paid' }));
    await user.click(await screen.findByRole('button', { name: 'New QR code' }));
    const afterGenuineExpiry = expiredCommits;
    expect(afterGenuineExpiry).toBeGreaterThan(0); // the probe does see a real expiry
    expect(await screen.findByText('5:00')).toBeInTheDocument();
    expect(expiredCommits).toBe(afterGenuineExpiry); // a new QR adds no expired commit
  });

  it('local countdown reaching 0 shows the expired state', async () => {
    const { user } = setupQr();
    await showQr(user);
    expect(await screen.findByText('5:00')).toBeInTheDocument();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(301_000);
    });
    expect(await screen.findByRole('alert')).toHaveTextContent('This QR code has expired.');
    expect(screen.getByRole('button', { name: 'New QR code' })).toBeInTheDocument();
  });

  it('counts down from the server duration even when the terminal clock is 10 minutes ahead', async () => {
    vi.setSystemTime(new Date('2026-10-22T10:10:00.000Z'));
    const { user } = setupQr();
    await showQr(user);
    expect(await screen.findByText('5:00')).toBeInTheDocument();
    expect(screen.queryByText('This QR code has expired.')).not.toBeInTheDocument();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(301_000);
    });
    expect(await screen.findByRole('alert')).toHaveTextContent('This QR code has expired.');
  });
});
