import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import i18n from '../../i18n';
import { App } from '../../App';
import { renderWithProviders } from '../../test/render';

const order = {
  id: 'o1',
  orderNumber: '20261022-0001',
  status: 'PENDING_PAYMENT',
  createdAt: '2026-10-22T03:15:00.000Z',
  createdBy: { id: 1, displayName: 'Cashier One' },
  total: '200.00',
  paymentMethod: null,
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

function setup(voidResponse: () => Response | Promise<Response>, afterVoid: 'PAID' | 'VOIDED' | 'PENDING_PAYMENT' = 'PENDING_PAYMENT') {
  localStorage.setItem(
    'pos.auth',
    JSON.stringify({ accessToken: 'tok', staff: { id: 1, displayName: 'Cashier One' }, appEnv: 'dev' }),
  );
  let voidCalled = false;
  const fetchStub = vi.fn().mockImplementation(async (url: string, init?: RequestInit) => {
    if (String(url).endsWith('/orders/o1/void') && init?.method === 'POST') {
      voidCalled = true;
      return voidResponse();
    }
    const o1 = voidCalled ? { ...order, status: afterVoid, paymentMethod: afterVoid === 'PAID' ? 'CASH' : null } : order;
    return json({ orders: [o1, { ...order, id: 'o2', orderNumber: '20261022-0002', status: 'PAID' }] });
  });
  vi.stubGlobal('fetch', fetchStub);
  renderWithProviders(<App />, { route: '/orders' });
  return { fetchStub, user: userEvent.setup() };
}

const listCalls = (f: ReturnType<typeof vi.fn>) =>
  f.mock.calls.filter((c) => String(c[0]).includes('/orders?')).length;

describe('VoidDialog', () => {
  beforeEach(async () => {
    await i18n.changeLanguage('en');
    vi.useFakeTimers({ shouldAdvanceTime: true });
    vi.setSystemTime(new Date('2026-10-21T17:30:00Z'));
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('only pending rows have a Void button', async () => {
    setup(() => json(order));
    await screen.findByRole('button', { name: 'Void' });
    expect(screen.getAllByRole('button', { name: 'Void' })).toHaveLength(1);
  });

  it('confirm stays disabled until a valid reason is chosen; OTHER needs a note', async () => {
    const { user } = setup(() => json(order));
    await user.click(await screen.findByRole('button', { name: 'Void' }));
    const confirm = screen.getByRole('button', { name: 'Void order' });
    expect(screen.getByLabelText('Reason')).toHaveDisplayValue('Choose a reason');
    expect(confirm).toBeDisabled();
    await user.selectOptions(screen.getByLabelText('Reason'), 'OTHER');
    expect(confirm).toBeDisabled();
    expect(screen.getByLabelText(/Note/)).toBeRequired();
    expect(screen.getByText('Please add a note when the reason is Other.')).toBeInTheDocument();
    await user.type(screen.getByLabelText(/Note/), '   ');
    expect(confirm).toBeDisabled();
    await user.type(screen.getByLabelText(/Note/), 'Spilled');
    expect(confirm).toBeEnabled();
  });

  it('confirm posts the void with an Idempotency-Key, closes and refetches the list', async () => {
    const { fetchStub, user } = setup(() => json({ ...order, status: 'VOIDED' }), 'VOIDED');
    await user.click(await screen.findByRole('button', { name: 'Void' }));
    await user.selectOptions(screen.getByLabelText('Reason'), 'OTHER');
    await user.type(screen.getByLabelText(/Note/), 'Spilled');
    const before = listCalls(fetchStub);
    await user.click(screen.getByRole('button', { name: 'Void order' }));
    await waitFor(() => expect(document.querySelector('dialog')).toBeNull());
    const call = fetchStub.mock.calls.find((c) => String(c[0]).endsWith('/orders/o1/void'));
    expect(call?.[1].method).toBe('POST');
    expect(JSON.parse(call?.[1].body)).toEqual({ reasonCode: 'OTHER', note: 'Spilled' });
    expect(call?.[1].headers['Idempotency-Key']).toBeTruthy();
    await waitFor(() => expect(listCalls(fetchStub)).toBeGreaterThan(before));
  });

  it('a non-OTHER reason sends no note', async () => {
    const { fetchStub, user } = setup(() => json({ ...order, status: 'VOIDED' }));
    await user.click(await screen.findByRole('button', { name: 'Void' }));
    await user.selectOptions(screen.getByLabelText('Reason'), 'OUT_OF_STOCK');
    await user.click(screen.getByRole('button', { name: 'Void order' }));
    await waitFor(() => expect(document.querySelector('dialog')).toBeNull());
    const call = fetchStub.mock.calls.find((c) => String(c[0]).endsWith('/orders/o1/void'));
    expect(JSON.parse(call?.[1].body)).toEqual({ reasonCode: 'OUT_OF_STOCK' });
  });

  it('409 VOID_NOT_ALLOWED shows the message, keeps the dialog and refetches the list', async () => {
    const { fetchStub, user } = setup(() => json({ error: { code: 'VOID_NOT_ALLOWED' } }, 409), 'PAID');
    await user.click(await screen.findByRole('button', { name: 'Void' }));
    await user.selectOptions(screen.getByLabelText('Reason'), 'OUT_OF_STOCK');
    const before = listCalls(fetchStub);
    await user.click(screen.getByRole('button', { name: 'Void order' }));
    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('Only unpaid orders can be voided.');
    await waitFor(() => expect(listCalls(fetchStub)).toBeGreaterThan(before));
    // The refetched row is now paid (no Void button), yet the dialog and its message stay.
    await waitFor(() => expect(screen.queryByRole('button', { name: 'Void' })).toBeNull());
    expect(document.querySelector('dialog')).toHaveAttribute('open');
    expect(screen.getByRole('alert')).toHaveTextContent('Only unpaid orders can be voided.');
  });

  it('disables the controls while the void is in flight', async () => {
    let release!: () => void;
    const { user } = setup(
      () => new Promise<Response>((r) => (release = () => r(json({ ...order, status: 'VOIDED' })))),
    );
    await user.click(await screen.findByRole('button', { name: 'Void' }));
    await user.selectOptions(screen.getByLabelText('Reason'), 'OUT_OF_STOCK');
    await user.click(screen.getByRole('button', { name: 'Void order' }));
    expect(await screen.findByRole('button', { name: 'Voiding…' })).toBeDisabled();
    expect(screen.getByLabelText('Reason')).toBeDisabled();
    release();
    await waitFor(() => expect(document.querySelector('dialog')).toBeNull());
  });

  it('Cancel closes without calling the API', async () => {
    const { fetchStub, user } = setup(() => json(order));
    await user.click(await screen.findByRole('button', { name: 'Void' }));
    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(document.querySelector('dialog')).toBeNull();
    expect(fetchStub.mock.calls.some((c) => String(c[0]).endsWith('/void'))).toBe(false);
  });
});
