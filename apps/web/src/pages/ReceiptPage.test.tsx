import { screen } from '@testing-library/react';
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
  transactions: [] as unknown[],
  discount: null as unknown,
  voided: null as unknown,
};

const tx = (o: object) => ({
  id: 't1', method: 'CASH', amount: '200.00', status: 'SUCCEEDED', qrPayload: null,
  cashReceived: null, change: null, createdAt: '2026-10-21T03:16:00.000Z', completedAt: '2026-10-21T03:16:00.000Z', expiresAt: null, ...o,
});

function jsonResponse(status: number, body: unknown) {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}

function renderReceipt(fetchImpl: () => Promise<Response>) {
  localStorage.setItem(
    'pos.auth',
    JSON.stringify({ accessToken: 'tok', staff: { id: 1, displayName: 'Cashier One' }, appEnv: 'dev' }),
  );
  vi.stubGlobal('fetch', vi.fn().mockImplementation(fetchImpl));
  return renderWithProviders(<App />, { route: '/orders/o1/receipt' });
}

describe('ReceiptPage', () => {
  beforeEach(async () => {
    await i18n.changeLanguage('en');
  });

  it('renders the order with formatted money and VAT breakdown', async () => {
    renderReceipt(async () => jsonResponse(200, order));
    expect(await screen.findByText('20261021-0001')).toBeInTheDocument();
    expect(screen.getByText(/2 × Medium Tea @ ฿55\.00/)).toBeInTheDocument();
    const single = screen.getByText(/1 × Large Coffee, Vanilla/);
    expect(single).not.toHaveTextContent('@');
    expect(screen.getAllByText('฿200.00')).toHaveLength(2);
    expect(screen.getByText('฿186.92')).toBeInTheDocument();
    expect(screen.getByText('VAT 7%')).toBeInTheDocument();
    expect(screen.getByText('฿13.08')).toBeInTheDocument();
    expect(screen.getByText('Pending payment')).toBeInTheDocument();
    expect(screen.getByText(/Oct 21, 2026/)).toHaveTextContent(/10:15/);
  });

  it('switches line descriptions to Thai', async () => {
    renderReceipt(async () => jsonResponse(200, order));
    await screen.findByText('20261021-0001');
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'Cashier One' }));
    await user.click(screen.getByRole('button', { name: 'ไทย' }));
    expect(await screen.findByText(/ชา แก้วกลาง/)).toBeInTheDocument();
  });

  it('prints via window.print', async () => {
    const print = vi.fn();
    vi.stubGlobal('print', print);
    renderReceipt(async () => jsonResponse(200, order));
    await screen.findByText('20261021-0001');
    await userEvent.setup().click(screen.getByRole('button', { name: 'Print' }));
    expect(print).toHaveBeenCalledTimes(1);
  });

  it('shows cash received and change for a cash-paid order', async () => {
    const paid = { ...order, status: 'PAID', transactions: [tx({ cashReceived: '250.00', change: '50.00' })] };
    renderReceipt(async () => jsonResponse(200, paid));
    expect(await screen.findByText('Paid')).toBeInTheDocument();
    expect(screen.getByText('Payment: Cash')).toBeInTheDocument();
    expect(screen.getByText('Received ฿250.00')).toBeInTheDocument();
    expect(screen.getByText('Change ฿50.00')).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Take payment' })).not.toBeInTheDocument();
  });

  it('shows Payment: QR for a QR-paid order', async () => {
    const paid = { ...order, status: 'PAID', transactions: [tx({ method: 'QR' })] };
    renderReceipt(async () => jsonResponse(200, paid));
    expect(await screen.findByText('Payment: QR')).toBeInTheDocument();
  });

  it('shows no payment required for a NONE transaction', async () => {
    const paid = { ...order, status: 'PAID', transactions: [tx({ method: 'NONE', amount: '0.00' })] };
    renderReceipt(async () => jsonResponse(200, paid));
    expect(await screen.findByText('Payment: No payment required')).toBeInTheDocument();
  });

  it('ignores non-succeeded transactions for the payment line', async () => {
    const paid = { ...order, transactions: [tx({ method: 'QR', status: 'EXPIRED' })] };
    renderReceipt(async () => jsonResponse(200, paid));
    await screen.findByText('20261021-0001');
    expect(screen.queryByText(/^Payment:/)).not.toBeInTheDocument();
  });

  it('shows the void reason and note for a voided order', async () => {
    const v = {
      ...order, status: 'VOIDED',
      voided: { at: '2026-10-21T04:00:00.000Z', by: { id: 1, displayName: 'Cashier One' }, reasonCode: 'OTHER', note: 'Spilled' },
    };
    renderReceipt(async () => jsonResponse(200, v));
    expect(await screen.findByText('Voided')).toBeInTheDocument();
    expect(screen.getByText('Other — Spilled')).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Take payment' })).not.toBeInTheDocument();
  });

  it('shows only the reason label when a voided order has no note', async () => {
    const v = {
      ...order, status: 'VOIDED',
      voided: { at: '2026-10-21T04:00:00.000Z', by: { id: 1, displayName: 'Cashier One' }, reasonCode: 'OUT_OF_STOCK', note: null },
    };
    renderReceipt(async () => jsonResponse(200, v));
    expect(await screen.findByText('Out of stock')).toBeInTheDocument();
  });

  it('links a pending order to the payment page', async () => {
    renderReceipt(async () => jsonResponse(200, order));
    const link = await screen.findByRole('link', { name: 'Take payment' });
    expect(link).toHaveAttribute('href', '/orders/o1/pay');
    expect(link).toHaveClass('print:hidden');
  });

  it('renders the paid status in Thai', async () => {
    await i18n.changeLanguage('th');
    renderReceipt(async () => jsonResponse(200, { ...order, status: 'PAID', transactions: [tx({ cashReceived: '250.00', change: '50.00' })] }));
    expect(await screen.findByText('ชำระแล้ว')).toBeInTheDocument();
  });

  const promo = {
    ...order,
    total: '180.00',
    discount: { presetCode: 'PROMO_10_PERCENT', nameEn: 'Promotion 10%', nameTh: 'โปรโมชัน ลด 10%', amount: '20.00' },
  };

  it('shows the discount line between subtotal and grand total', async () => {
    renderReceipt(async () => jsonResponse(200, promo));
    expect(await screen.findByText('Discount: Promotion 10%')).toBeInTheDocument();
    expect(screen.getByText('−฿20.00')).toBeInTheDocument();
    const text = document.body.textContent ?? '';
    const at = (s: string) => text.indexOf(s);
    expect(at('Subtotal')).toBeLessThan(at('Discount: Promotion 10%'));
    expect(at('Discount: Promotion 10%')).toBeLessThan(at('Grand Total'));
  });

  it('shows the discount line in Thai', async () => {
    await i18n.changeLanguage('th');
    renderReceipt(async () => jsonResponse(200, promo));
    expect(await screen.findByText('ส่วนลด: โปรโมชัน ลด 10%')).toBeInTheDocument();
    expect(screen.getByText('−฿20.00')).toBeInTheDocument();
  });

  it('shows no discount line when the order has no discount', async () => {
    renderReceipt(async () => jsonResponse(200, order));
    await screen.findByText('20261021-0001');
    expect(screen.queryByText(/Discount:/)).not.toBeInTheDocument();
  });

  it('shows the translated NOT_FOUND message on 404', async () => {
    renderReceipt(async () => jsonResponse(404, { error: { code: 'NOT_FOUND' } }));
    expect(await screen.findByRole('alert')).toHaveTextContent('We could not find what you were looking for.');
  });
});
