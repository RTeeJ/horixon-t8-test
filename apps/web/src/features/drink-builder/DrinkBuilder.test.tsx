import { act, fireEvent, screen, within } from '@testing-library/react';
import type { ReactNode } from 'react';
import userEvent from '@testing-library/user-event';
import i18n from '../../i18n';
import { renderWithProviders } from '../../test/render';
// Fixture reused from the domain package: the seed rows of requirements §4.1.
import { SEED_MENU } from '../../../../../packages/domain/test/fixtures';
import { DrinkBuilder } from './DrinkBuilder';

type User = ReturnType<typeof userEvent.setup>;

function stubMenu() {
  const items = SEED_MENU.map(({ isActive: _a, ...rest }) => rest);
  vi.stubGlobal(
    'fetch',
    vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ items }), { status: 200, headers: { 'Content-Type': 'application/json' } }),
    ),
  );
}

async function setup(extra?: ReactNode) {
  stubMenu();
  const onAdd = vi.fn();
  renderWithProviders(
    <>
      <DrinkBuilder onAdd={onAdd} />
      {extra}
    </>,
  );
  await screen.findByRole('button', { name: /^Coffee/ });
  return { onAdd, user: userEvent.setup() };
}

/** Clicks the base card whose accessible name matches, then waits for the customise dialog. */
async function openCard(user: User, name: RegExp) {
  await user.click(screen.getByRole('button', { name }));
  return screen.findByRole('dialog');
}

const plus = (n: string) => screen.getByRole('button', { name: `Increase ${n}` });

describe('DrinkBuilder', () => {
  beforeEach(async () => {
    await i18n.changeLanguage('en');
  });

  it('builds a drink, shows description and price, adds to cart and resets', async () => {
    const { onAdd, user } = await setup();
    await openCard(user, /^Coffee/);
    await user.click(screen.getByRole('button', { name: /^Large/ }));
    await user.click(plus('Vanilla'));
    await user.click(plus('Vanilla'));
    await user.click(plus('Whipped Cream'));
    expect(screen.getByTestId('description')).toHaveTextContent('Large Coffee, 2x Vanilla, Whipped Cream');
    expect(screen.getByTestId('price')).toHaveTextContent('฿115.00');
    await user.click(screen.getByRole('button', { name: 'Add to cart' }));
    expect(onAdd).toHaveBeenCalledWith({
      base: 'COFFEE',
      size: 'SIZE_LARGE',
      addOns: [
        { code: 'VANILLA', count: 2 },
        { code: 'WHIPPED_CREAM', count: 1 },
      ],
    });
    expect(screen.queryByRole('dialog')).toBeNull();
    await openCard(user, /^Coffee/);
    expect(screen.getByLabelText('Vanilla count')).toHaveTextContent('0');
    expect(screen.getByRole('button', { name: 'Add to cart' })).toBeDisabled();
  });

  it('opens a dialog for the picked base', async () => {
    const { user } = await setup();
    expect(screen.getByRole('button', { name: 'Tea ชา ฿40.00' })).toBeInTheDocument();
    const dialog = await openCard(user, /^Tea/);
    expect(within(dialog).getByRole('heading', { name: 'Tea' })).toBeInTheDocument();
    expect(within(dialog).getByText('from ฿40.00')).toBeInTheDocument();
  });

  it('disables Add to cart without a size', async () => {
    const { user } = await setup();
    await openCard(user, /^Coffee/);
    expect(screen.getByRole('button', { name: 'Add to cart' })).toBeDisabled();
  });

  it('disables + at 5 of one add-on and at 10 add-ons in total; shows both remarks', async () => {
    const { user } = await setup();
    await openCard(user, /^Coffee/);
    expect(screen.getByText('Up to 10 add-ons per drink.')).toBeInTheDocument();
    expect(screen.getByText('Up to 5 of the same add-on.')).toBeInTheDocument();
    for (let i = 0; i < 5; i++) await user.click(plus('Vanilla'));
    expect(plus('Vanilla')).toBeDisabled();
    expect(plus('Caramel')).toBeEnabled();
    for (let i = 0; i < 5; i++) await user.click(plus('Caramel'));
    for (const n of ['Extra Coffee Shot', 'Extra Milk', 'Vanilla', 'Caramel', 'Chocolate', 'Whipped Cream', 'Cinnamon', 'Marshmallows']) {
      expect(plus(n)).toBeDisabled();
    }
  });

  it('counts add-ons in the Optional tag', async () => {
    const { user } = await setup();
    await openCard(user, /^Coffee/);
    expect(screen.getByText('Optional · 0/10')).toBeInTheDocument();
    await user.click(plus('Vanilla'));
    await user.click(plus('Vanilla'));
    await user.click(plus('Cinnamon'));
    expect(screen.getByText('Optional · 3/10')).toBeInTheDocument();
  });

  it('closes on the close button and on Escape, discarding the draft', async () => {
    const { user } = await setup();
    await openCard(user, /^Coffee/);
    await user.click(screen.getByRole('button', { name: /^Large/ }));
    await user.click(screen.getByRole('button', { name: 'Close' }));
    expect(screen.queryByRole('dialog')).toBeNull();
    await openCard(user, /^Coffee/);
    expect(screen.getByRole('button', { name: /^Large/ })).not.toHaveAttribute('aria-pressed', 'true');
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('closes on a backdrop click but not on a click inside', async () => {
    const { user } = await setup();
    const dialog = await openCard(user, /^Coffee/);
    await user.click(within(dialog).getByRole('heading', { name: 'Coffee' }));
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    fireEvent.click(dialog);
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('adds once on a double click', async () => {
    const { onAdd, user } = await setup();
    await openCard(user, /^Coffee/);
    await user.click(screen.getByRole('button', { name: /^Large/ }));
    await user.dblClick(screen.getByRole('button', { name: 'Add to cart' }));
    expect(onAdd).toHaveBeenCalledTimes(1);
  });

  it('ignores a second Add before the dialog unmounts', async () => {
    // user.dblClick lets React unmount the dialog between the clicks; inside one act() it
    // cannot, so this is what proves the guard.
    const { onAdd, user } = await setup();
    await openCard(user, /^Coffee/);
    await user.click(screen.getByRole('button', { name: /^Large/ }));
    const add = screen.getByRole('button', { name: 'Add to cart' });
    act(() => {
      fireEvent.click(add);
      fireEvent.click(add);
    });
    expect(onAdd).toHaveBeenCalledTimes(1);
  });

  // A double click is two click events; the second has `detail` 2. The modal opens (or
  // closes) between them, so the second click must not land on whatever is now under it.
  describe('ghost second clicks of a double click', () => {
    it('a card ignores the second click', async () => {
      await setup();
      fireEvent.click(screen.getByRole('button', { name: /^Coffee/ }), { detail: 2 });
      expect(screen.queryByRole('dialog')).toBeNull();
    });

    it('the just-opened dialog ignores it on the backdrop and on its controls', async () => {
      const { user } = await setup();
      const dialog = await openCard(user, /^Coffee/);
      fireEvent.click(dialog, { detail: 2 });
      expect(screen.getByRole('dialog')).toBeInTheDocument();
      fireEvent.click(screen.getByRole('button', { name: /^Large/ }), { detail: 2 });
      expect(screen.getByRole('button', { name: /^Large/ })).toHaveAttribute('aria-pressed', 'false');
      fireEvent.click(plus('Vanilla'), { detail: 3 });
      expect(screen.getByLabelText('Vanilla count')).toHaveTextContent('0');
    });

    it('still counts quick repeated clicks made inside the dialog', async () => {
      const { user } = await setup();
      await openCard(user, /^Coffee/);
      await user.dblClick(plus('Vanilla'));
      expect(screen.getByLabelText('Vanilla count')).toHaveTextContent('2');
    });

    it('the page behind ignores it after Add, then works again', async () => {
      const behind = vi.fn();
      const { user } = await setup(
        <button type="button" onClick={behind}>
          Place order
        </button>,
      );
      await openCard(user, /^Coffee/);
      await user.click(screen.getByRole('button', { name: /^Large/ }));
      await user.click(screen.getByRole('button', { name: 'Add to cart' }));
      expect(screen.queryByRole('dialog')).toBeNull();
      const place = screen.getByRole('button', { name: 'Place order' });
      fireEvent.click(place, { detail: 2 });
      expect(behind).not.toHaveBeenCalled();
      fireEvent.click(place, { detail: 1 });
      fireEvent.click(place, { detail: 2 });
      expect(behind).toHaveBeenCalledTimes(2);
    });

    it('the page behind ignores the rest of a double click on the backdrop', async () => {
      const behind = vi.fn();
      const { user } = await setup(
        <button type="button" onClick={behind}>
          Place order
        </button>,
      );
      await openCard(user, /^Coffee/);
      fireEvent.click(screen.getByRole('dialog'));
      expect(screen.queryByRole('dialog')).toBeNull();
      const place = screen.getByRole('button', { name: 'Place order' });
      fireEvent.click(place, { detail: 2 });
      expect(behind).not.toHaveBeenCalled();
      fireEvent.click(place, { detail: 1 });
      expect(behind).toHaveBeenCalledTimes(1);
    });

    it('the page behind ignores the rest of a double click on the close button', async () => {
      const behind = vi.fn();
      const { user } = await setup(
        <button type="button" onClick={behind}>
          Place order
        </button>,
      );
      await openCard(user, /^Coffee/);
      await user.click(screen.getByRole('button', { name: 'Close' }));
      expect(screen.queryByRole('dialog')).toBeNull();
      const place = screen.getByRole('button', { name: 'Place order' });
      fireEvent.click(place, { detail: 2 });
      expect(behind).not.toHaveBeenCalled();
      fireEvent.click(place, { detail: 1 });
      expect(behind).toHaveBeenCalledTimes(1);
    });
  });

  it('switches language while open and keeps the draft', async () => {
    const { user } = await setup();
    await openCard(user, /^Coffee/);
    await user.click(screen.getByRole('button', { name: /^Large/ }));
    await user.click(plus('Vanilla'));
    await act(() => i18n.changeLanguage('th'));
    expect(screen.getByTestId('description')).toHaveTextContent('กาแฟ แก้วใหญ่, วานิลลา');
    expect(screen.getByLabelText('จำนวน วานิลลา')).toHaveTextContent('1');
  });

  it('describes in Thai', async () => {
    const { user } = await setup();
    await i18n.changeLanguage('th');
    await screen.findByRole('button', { name: /^กาแฟ/ });
    await openCard(user, /^กาแฟ/);
    await user.click(screen.getByRole('button', { name: /^แก้วใหญ่/ }));
    await user.click(screen.getByRole('button', { name: 'เพิ่ม วานิลลา' }));
    await user.click(screen.getByRole('button', { name: 'เพิ่ม วานิลลา' }));
    await user.click(screen.getByRole('button', { name: 'เพิ่ม วิปครีม' }));
    expect(screen.getByTestId('description')).toHaveTextContent('กาแฟ แก้วใหญ่, 2x วานิลลา, วิปครีม');
  });

  it('shows the translated error for the API error code when /menu fails', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ error: { code: 'INTERNAL' } }), { status: 500 }),
      ),
    );
    renderWithProviders(<DrinkBuilder onAdd={vi.fn()} />);
    expect(screen.getByText('Loading menu…')).toBeInTheDocument();
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Something went wrong on our side. Please try again.',
    );
  });
});
