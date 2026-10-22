import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Route, Routes } from 'react-router-dom';
import i18n from '../../i18n';
import { useDiscountPresets, useMenu } from '../../api/hooks';
import { renderWithProviders } from '../../test/render';
import { SEED_MENU, SEED_PRESETS } from '../../../../../packages/domain/test/fixtures';
import { CartPanel } from './CartPanel';
import { useCart, CART_KEY, CART_DISCOUNT_KEY } from './useCart';

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

function Harness() {
  const menu = useMenu();
  if (!menu.data) return null;
  return <Inner menu={menu.data} />;
}
function Inner({ menu }: { menu: NonNullable<ReturnType<typeof useMenu>['data']> }) {
  return <CartPanel cart={useCart(menu, useDiscountPresets().data)} />;
}

const mediumTea = { key: 'Medium Tea', recipe: { base: 'TEA', size: 'SIZE_MEDIUM', addOns: [] }, quantity: 2 };
const largeVanilla = {
  key: 'Large Coffee, Vanilla',
  recipe: { base: 'COFFEE', size: 'SIZE_LARGE', addOns: [{ code: 'VANILLA', count: 1 }] },
  quantity: 1,
};

function setup(
  cart: unknown[],
  opts: {
    omit?: string;
    order?: () => Promise<Response>;
    presetsStatus?: number;
    /** Answers successive GET /discount-presets calls; the last entry repeats. */
    presetsBodies?: unknown[];
  } = {},
) {
  localStorage.setItem(CART_KEY, JSON.stringify(cart));
  const items = SEED_MENU.filter((m) => m.code !== opts.omit).map(({ isActive: _a, ...r }) => r);
  let presetCalls = 0;
  const fetchStub = vi.fn().mockImplementation(async (url: string) => {
    if (String(url).endsWith('/menu')) return json(200, { items });
    if (String(url).endsWith('/discount-presets')) {
      const bodies = opts.presetsBodies ?? [{ presets: SEED_PRESETS }];
      const body = bodies[Math.min(presetCalls++, bodies.length - 1)];
      return json(opts.presetsStatus ?? 200, opts.presetsStatus ? { error: { code: 'INTERNAL' } } : body);
    }
    return (opts.order ?? (async () => json(201, { id: 'o1' })))();
  });
  vi.stubGlobal('fetch', fetchStub);
  renderWithProviders(
    <Routes>
      <Route path="/" element={<Harness />} />
      <Route path="/orders/:id/pay" element={<p>payment page</p>} />
    </Routes>,
  );
  return { fetchStub, user: userEvent.setup() };
}

const orderKeys = (f: ReturnType<typeof vi.fn>) => orderCalls(f).map((c) => c[1].headers['Idempotency-Key']);
const orderCalls = (f: ReturnType<typeof vi.fn>) => f.mock.calls.filter((c) => String(c[0]).endsWith('/orders'));
const presetFetches = (f: ReturnType<typeof vi.fn>) => f.mock.calls.filter((c) => String(c[0]).endsWith('/discount-presets'));
const option = (name: string) => screen.getByRole('option', { name });

describe('CartPanel', () => {
  beforeEach(async () => {
    await i18n.changeLanguage('en');
  });

  it('totals 2 Medium Tea + Large Coffee Vanilla; posts once, clears, navigates', async () => {
    let release!: () => void;
    const { fetchStub, user } = setup([mediumTea, largeVanilla], {
      order: () => new Promise((r) => (release = () => r(json(201, { id: 'o1' })))),
    });
    expect(await screen.findByTestId('total')).toHaveTextContent('฿200.00');
    const btn = screen.getByRole('button', { name: 'Place order' });
    await user.click(btn);
    await user.click(btn);
    await waitFor(() => expect(orderCalls(fetchStub)).toHaveLength(1));
    expect(JSON.parse(orderCalls(fetchStub)[0][1].body)).toEqual({
      lines: [
        { base: 'TEA', size: 'SIZE_MEDIUM', addOns: [], quantity: 2 },
        { base: 'COFFEE', size: 'SIZE_LARGE', addOns: [{ code: 'VANILLA', count: 1 }], quantity: 1 },
      ],
    });
    release();
    expect(await screen.findByText('payment page')).toBeInTheDocument();
    expect(localStorage.getItem(CART_KEY)).toBeNull();
    expect(orderCalls(fetchStub)).toHaveLength(1);
  });

  it('sends an Idempotency-Key and reuses it after a network failure', async () => {
    let n = 0;
    const { fetchStub, user } = setup([mediumTea], {
      order: async () => {
        if (n++ === 0) throw new TypeError('network');
        return json(201, { id: 'o1' });
      },
    });
    await user.click(await screen.findByRole('button', { name: 'Place order' }));
    expect(await screen.findByRole('alert')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Place order' }));
    expect(await screen.findByText('payment page')).toBeInTheDocument();
    const keys = orderKeys(fetchStub);
    expect(keys).toHaveLength(2);
    expect(keys[0]).toMatch(/^[0-9a-f-]{36}$/);
    expect(keys[1]).toBe(keys[0]);
  });

  it('disables Place order and suggests splitting at 21 cups', async () => {
    setup([{ ...mediumTea, quantity: 21 }]);
    expect(await screen.findByText('Too many cups. The maximum is 20 per order.')).toBeInTheDocument();
    expect(screen.getByText(/split this into more than one order/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Place order' })).toBeDisabled();
  });

  it('flags a stale line, blocks ordering, and re-enables after removal', async () => {
    const { user } = setup([mediumTea, largeVanilla], { omit: 'TEA' });
    expect(await screen.findByText('This menu item is not available.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Place order' })).toBeDisabled();
    await user.click(screen.getByRole('button', { name: 'Remove Medium Tea' }));
    expect(screen.queryByText('This menu item is not available.')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Place order' })).toBeEnabled();
  });

  it('changes quantity and shows translated API detail errors', async () => {
    const { user } = setup([largeVanilla], {
      order: async () =>
        json(400, {
          error: {
            code: 'VALIDATION_FAILED',
            details: [{ line: 0, code: 'ADDON_LIMIT_EXCEEDED', params: { max: 10 } }],
          },
        }),
    });
    await user.click(await screen.findByRole('button', { name: 'Increase Large Coffee, Vanilla' }));
    expect(screen.getByLabelText('Large Coffee, Vanilla quantity')).toHaveTextContent('2');
    await user.click(screen.getByRole('button', { name: 'Place order' }));
    expect(await screen.findByText(/Too many add-ons. The maximum is 10 per drink./)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Place order' })).toBeEnabled();
  });

  it('falls back to an empty cart when stored add-ons are corrupt', async () => {
    setup([{ ...largeVanilla, recipe: { ...largeVanilla.recipe, addOns: [null, { code: 5 }] } }]);
    expect(await screen.findByText('No drinks yet. Build one on the left.')).toBeInTheDocument();
  });

  it('clears a stale API error when the cart changes', async () => {
    const { user } = setup([largeVanilla], {
      order: async () => json(400, { error: { code: 'VALIDATION_FAILED', details: [{ line: 0, code: 'ADDON_LIMIT_EXCEEDED', params: { max: 10 } }] } }),
    });
    await user.click(await screen.findByRole('button', { name: 'Place order' }));
    expect(await screen.findByText(/Too many add-ons/)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Increase Large Coffee, Vanilla' }));
    expect(screen.queryByText(/Too many add-ons. The maximum is 10 per drink./)).not.toBeInTheDocument();
  });

  it('shows the cup count and per-cup price', async () => {
    setup([mediumTea, largeVanilla]);
    expect(await screen.findByText('3 cups')).toBeInTheDocument();
    expect(screen.getByText('฿55.00 / cup')).toBeInTheDocument();
  });

  it('shows a singular cup count', async () => {
    setup([largeVanilla]);
    expect(await screen.findByText('1 cup')).toBeInTheDocument();
  });

  it('shows the empty state', async () => {
    setup([]);
    expect(await screen.findByText('No drinks yet. Build one on the left.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Place order' })).toBeDisabled();
  });

  describe('discount', () => {
    it('lists presets and greys out ones below min spend', async () => {
      setup([largeVanilla, { ...mediumTea, quantity: 1 }]);
      expect(await screen.findByTestId('total')).toHaveTextContent('฿145.00');
      await screen.findByRole('option', { name: 'Staff discount 15%' });
      expect(option('No discount')).toBeEnabled();
      expect(option('Staff discount 15%')).toBeEnabled();
      expect(option('Promotion 10%')).toBeEnabled();
      expect(option('Promotion ฿30 — Min. spend ฿200.00')).toBeDisabled();
    });

    it('applies PROMO_10_PERCENT and sends it', async () => {
      const { fetchStub, user } = setup([mediumTea, largeVanilla]);
      await screen.findByRole('option', { name: 'Promotion 10%' });
      await user.selectOptions(screen.getByLabelText('Discount'), 'PROMO_10_PERCENT');
      expect(screen.getByText('Discount: Promotion 10%')).toBeInTheDocument();
      expect(screen.getByTestId('discount')).toHaveTextContent('−฿20.00');
      expect(screen.getByTestId('total')).toHaveTextContent('฿180.00');
      expect(localStorage.getItem(CART_DISCOUNT_KEY)).toBe('PROMO_10_PERCENT');
      await user.click(screen.getByRole('button', { name: 'Place order' }));
      expect(await screen.findByText('payment page')).toBeInTheDocument();
      expect(JSON.parse(orderCalls(fetchStub)[0][1].body).discount).toEqual({ presetCode: 'PROMO_10_PERCENT' });
      expect(localStorage.getItem(CART_DISCOUNT_KEY)).toBeNull();
    });

    it('drops a preset that stops qualifying', async () => {
      const { user } = setup([mediumTea, largeVanilla]);
      await screen.findByRole('option', { name: 'Promotion ฿30' });
      await user.selectOptions(screen.getByLabelText('Discount'), 'PROMO_30_BAHT');
      expect(screen.getByTestId('total')).toHaveTextContent('฿170.00');
      await user.click(screen.getByRole('button', { name: 'Decrease Medium Tea' }));
      const notice = await screen.findByText('Promotion ฿30 was removed: it needs a minimum spend of ฿200.00.');
      expect(notice).toHaveAttribute('role', 'status');
      expect(screen.getByLabelText('Discount')).toHaveValue('');
      expect(screen.queryByTestId('discount')).not.toBeInTheDocument();
      expect(screen.getByTestId('total').textContent).toBe(screen.getByTestId('subtotal').textContent);
      expect(localStorage.getItem(CART_DISCOUNT_KEY)).toBeNull();
    });

    it('restores the stored discount', async () => {
      localStorage.setItem(CART_DISCOUNT_KEY, 'STAFF_15');
      setup([mediumTea, largeVanilla]);
      await waitFor(() => expect(screen.getByLabelText('Discount')).toHaveValue('STAFF_15'));
      expect(screen.getByTestId('discount')).toHaveTextContent('−฿30.00');
      expect(screen.getByTestId('total')).toHaveTextContent('฿170.00');
    });

    it('presets fail to load: select disabled, nothing applied, stored code kept', async () => {
      localStorage.setItem(CART_DISCOUNT_KEY, 'STAFF_15');
      const { fetchStub, user } = setup([mediumTea, largeVanilla], { presetsStatus: 500 });
      await waitFor(() => expect(presetFetches(fetchStub)).toHaveLength(1));
      expect(await screen.findByTestId('total')).toHaveTextContent('฿200.00');
      expect(screen.getByLabelText('Discount')).toBeDisabled();
      expect(await screen.findByText('Discounts are unavailable right now.')).toBeInTheDocument();
      expect(screen.queryByTestId('discount')).not.toBeInTheDocument();
      expect(localStorage.getItem(CART_DISCOUNT_KEY)).toBe('STAFF_15');
      await user.click(screen.getByRole('button', { name: 'Place order' }));
      await screen.findByText('payment page');
      expect(JSON.parse(orderCalls(fetchStub)[0][1].body).discount).toBeUndefined();
    });

    it('uses a new idempotency key when the discount changes after a failure', async () => {
      const { fetchStub, user } = setup([mediumTea, largeVanilla], {
        order: async () => json(500, { error: { code: 'INTERNAL' } }),
      });
      await screen.findByRole('option', { name: 'Promotion 10%' });
      await user.selectOptions(screen.getByLabelText('Discount'), 'STAFF_15');
      await user.click(screen.getByRole('button', { name: 'Place order' }));
      await screen.findByRole('alert');
      await user.selectOptions(screen.getByLabelText('Discount'), 'PROMO_10_PERCENT');
      await user.click(screen.getByRole('button', { name: 'Place order' }));
      await waitFor(() => expect(orderKeys(fetchStub)).toHaveLength(2));
      const keys = orderKeys(fetchStub);
      expect(keys[1]).not.toBe(keys[0]);
    });

    it('handles a preset retired on the server', async () => {
      const { fetchStub, user } = setup([mediumTea, largeVanilla], {
        presetsBodies: [{ presets: SEED_PRESETS }, { presets: SEED_PRESETS.filter((p) => p.code.startsWith('PROMO_')) }],
        order: async () =>
          json(400, { error: { code: 'VALIDATION_FAILED', details: [{ code: 'DISCOUNT_PRESET_UNAVAILABLE' }] } }),
      });
      await screen.findByRole('option', { name: 'Staff discount 15%' });
      await user.selectOptions(screen.getByLabelText('Discount'), 'STAFF_15');
      await user.click(screen.getByRole('button', { name: 'Place order' }));
      await waitFor(() => expect(presetFetches(fetchStub)).toHaveLength(2));
      const notice = await screen.findByText('The selected discount is no longer available and was removed.');
      expect(notice).toHaveAttribute('role', 'status');
      expect(screen.getByLabelText('Discount')).toHaveValue('');
    });

    it('shows the alert for a retired preset before the refetch lands', async () => {
      const { user } = setup([mediumTea, largeVanilla], {
        presetsBodies: [{ presets: SEED_PRESETS }],
        order: async () =>
          json(400, { error: { code: 'VALIDATION_FAILED', details: [{ code: 'DISCOUNT_PRESET_UNAVAILABLE' }] } }),
      });
      await screen.findByRole('option', { name: 'Staff discount 15%' });
      await user.selectOptions(screen.getByLabelText('Discount'), 'STAFF_15');
      await user.click(screen.getByRole('button', { name: 'Place order' }));
      expect(await screen.findByText('This discount is no longer available. Please choose another.')).toBeInTheDocument();
    });

    it('shows Thai preset names', async () => {
      setup([mediumTea, largeVanilla]);
      await screen.findByRole('option', { name: 'Promotion 10%' });
      await i18n.changeLanguage('th');
      expect(await screen.findByRole('option', { name: 'โปรโมชัน ลด 10%' })).toBeInTheDocument();
    });
  });
});
