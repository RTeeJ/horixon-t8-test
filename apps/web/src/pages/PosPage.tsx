import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { describe, DrinkBuilder as Builder, type Menu } from '@coffee/domain';
import { useDiscountPresets, useMenu } from '../api/hooks';
import { CartPanel } from '../features/cart/CartPanel';
import { useCart } from '../features/cart/useCart';
import { DrinkBuilder } from '../features/drink-builder/DrinkBuilder';

export function PosPage() {
  const menu = useMenu();
  return menu.data ? (
    <Workspace menu={menu.data} />
  ) : (
    <Layout cart={null}>
      <DrinkBuilder onAdd={() => {}} />
    </Layout>
  );
}

/**
 * Menu column + cart column. The sticky Header above is 3.5rem (h-14) tall and `p-6` adds 1.5rem,
 * so the cart starts at top-20 and stays there (sticky) just under the Header, filling the viewport
 * to 1.5rem from the bottom.
 */
function Layout({ children, cart }: { children: ReactNode; cart: ReactNode }) {
  const { t } = useTranslation('common');
  return (
    <main className="grid gap-6 p-6 lg:grid-cols-[1fr_360px]">
      <h1 className="sr-only">{t('pos.heading')}</h1>
      <section className="min-w-0">
        <h2 className="mb-4 text-xl font-semibold">{t('menu.heading')}</h2>
        {children}
      </section>
      <aside className="lg:sticky lg:top-20 lg:h-[calc(100vh-6.5rem)] lg:self-start lg:overflow-y-auto">{cart}</aside>
    </main>
  );
}

function Workspace({ menu }: { menu: Menu }) {
  const cart = useCart(menu, useDiscountPresets().data);
  return (
    <Layout cart={<CartPanel cart={cart} />}>
      <DrinkBuilder
        onAdd={(recipe) => {
          const b = Builder.on(menu).base(recipe.base).size(recipe.size);
          for (const a of recipe.addOns) b.add(a.code, a.count);
          const built = b.build();
          if (built.ok) cart.dispatch({ type: 'add', key: describe(built.unwrap(), 'en'), recipe });
        }}
      />
    </Layout>
  );
}
