import { useEffect, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { Coffee, Trash2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { DEFAULT_LIMITS, Money, type DomainError, type Lang } from '@coffee/domain';
import { ApiError } from '../../api/client';
import { useDiscountPresets, usePlaceOrder } from '../../api/hooks';
import { useIdempotencyKey } from '../../api/idempotency';
import { MenuImage } from '../../components/MenuImage';
import { Stepper } from '../../components/Stepper';
import { errorMessage } from '../../i18n/error-message';
import { DiscountSelect } from './DiscountSelect';
import { clearStoredCart, type Cart } from './useCart';

export function CartPanel({ cart }: { cart: Cart }) {
  const { t, i18n } = useTranslation('cart');
  const lang: Lang = i18n.language === 'th' ? 'th' : 'en';
  const navigate = useNavigate();
  const place = usePlaceOrder();
  const inFlight = useRef(false);
  const idem = useIdempotencyKey();
  const queryClient = useQueryClient();
  const presetsQuery = useDiscountPresets();
  const presets = presetsQuery.data;
  const { lines, dispatch, quote, lineViews, presetCode, input, discountNotice, baseSubtotal, setDiscount } = cart;
  const { reset } = place;

  // A previous server error no longer describes the cart once it changes.
  useEffect(() => {
    reset();
  }, [lines, presetCode, reset]);

  const errors: DomainError[] = quote.ok ? [] : quote.errors;
  const lineErrors = (i: number) => errors.filter((e) => e.line === i);
  const orderErrors = errors.filter((e) => e.line === undefined && e.code !== 'ORDER_EMPTY');
  const cupLimit = orderErrors.some((e) => e.code === 'ORDER_CUP_LIMIT_EXCEEDED');
  const cups = lines.reduce((n, l) => n + l.quantity, 0);
  const msg = (e: DomainError) => errorMessage(t, e.code, e.params);

  const submit = () => {
    if (inFlight.current || !quote.ok) return;
    inFlight.current = true;
    place.mutate(
      { input, idempotencyKey: idem.keyFor(input) },
      {
        onSuccess: (order) => {
          idem.reset();
          dispatch({ type: 'clear' });
          clearStoredCart();
          navigate(`/orders/${order.id}/pay`);
        },
        onError: (error) => {
          // The preset was retired meanwhile: refetch so the select drops it (D§8).
          if (error instanceof ApiError && error.details.some((d) => d.code === 'DISCOUNT_PRESET_UNAVAILABLE')) {
            void queryClient.invalidateQueries({ queryKey: ['discount-presets'] });
          }
        },
        onSettled: () => {
          inFlight.current = false;
        },
      },
    );
  };

  const apiError = place.error instanceof ApiError ? place.error : place.error ? new ApiError(0, 'INTERNAL') : null;

  const hasAlert = orderErrors.length > 0 || cupLimit || apiError !== null;

  return (
    <section className="flex h-full flex-col rounded-2xl bg-surface shadow-card">
      <h2 className="flex items-center justify-between px-4 pt-4 pb-2 font-semibold">
        {t('heading')}
        <span className="rounded-full bg-accent-soft px-2.5 py-0.5 text-xs font-medium text-accent-ink">
          {t('cups', { count: cups })}
        </span>
      </h2>
      {lines.length === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-2 px-4 text-center text-muted">
          <Coffee aria-hidden="true" className="size-8" />
          <p>{t('empty')}</p>
        </div>
      ) : (
        <ul className="flex-1 overflow-y-auto px-4">
          {lines.map((l, i) => {
            const view = lineViews[i];
            const label = view ? (lang === 'th' ? view.descriptionTh : view.descriptionEn) : l.key;
            return (
              <li key={l.key} className="border-b border-line py-3 last:border-b-0">
                <div className="flex gap-3">
                  <MenuImage key={l.recipe.base} code={l.recipe.base} alt="" className="size-10 shrink-0 rounded-lg" />
                  <div className="min-w-0 flex-1">
                    <p className="break-words font-semibold">{label}</p>
                    {view && <p className="text-xs text-muted">{t('perCup', { price: view.unitPrice.format() })}</p>}
                  </div>
                  {view && <b className="shrink-0 tabular-nums">{view.lineTotal.format()}</b>}
                </div>
                <div className="mt-2 flex items-center justify-between">
                  <Stepper
                    value={l.quantity}
                    decreaseLabel={t('decrease', { name: label })}
                    increaseLabel={t('increase', { name: label })}
                    countLabel={t('quantity', { name: label })}
                    canDecrease
                    canIncrease
                    onDecrease={() => dispatch({ type: 'setQuantity', key: l.key, quantity: l.quantity - 1 })}
                    onIncrease={() => dispatch({ type: 'setQuantity', key: l.key, quantity: l.quantity + 1 })}
                  />
                  <button
                    type="button"
                    aria-label={t('remove', { name: label })}
                    onClick={() => dispatch({ type: 'remove', key: l.key })}
                    className="rounded-full p-2 text-muted hover:text-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                  >
                    <Trash2 aria-hidden="true" className="size-4" />
                  </button>
                </div>
                {lineErrors(i).map((e, n) => (
                  <p key={n} role="alert" className="mt-1 text-sm text-danger">
                    {msg(e)}
                  </p>
                ))}
              </li>
            );
          })}
        </ul>
      )}
      <div className="border-t border-line p-4">
        {hasAlert && (
          <div className="mb-3 space-y-1 rounded-xl border border-danger/30 bg-danger/5 p-3 text-sm text-danger">
            {orderErrors.map((e, n) => (
              <p key={n} role="alert">
                {msg(e)}
              </p>
            ))}
            {cupLimit && <p>{t('splitHint', { max: DEFAULT_LIMITS.maxCups })}</p>}
            {apiError && (
              <div role="alert">
                {apiError.details.length > 0 ? (
                  <ul>
                    {apiError.details.map((d, n) => (
                      <li key={n}>
                        {d.line !== undefined && `${t('lineNumber', { n: d.line + 1 })}: `}
                        {msg(d)}
                      </li>
                    ))}
                  </ul>
                ) : (
                  errorMessage(t, apiError.code)
                )}
              </div>
            )}
          </div>
        )}
        <DiscountSelect presets={presets} baseSubtotal={baseSubtotal} value={presetCode} onChange={setDiscount} />
        {presetsQuery.isError && <p className="-mt-2 mb-3 text-xs text-muted">{t('discountsUnavailable')}</p>}
        {discountNotice && (
          <p role="status" className="mb-3 rounded-xl bg-accent-soft p-3 text-sm text-accent-ink">
            {discountNotice.kind === 'minSpend'
              ? t('discountRemoved', {
                  name: lang === 'th' ? discountNotice.preset.nameTh : discountNotice.preset.nameEn,
                  amount: Money.of(discountNotice.preset.minSubtotal ?? '0').format(),
                })
              : t('discountUnavailable')}
          </p>
        )}
        {quote.ok && (
          <dl className="grid grid-cols-[1fr_auto] gap-x-4 gap-y-1">
            <dt className="text-muted">{t('subtotal')}</dt>
            <dd data-testid="subtotal" className="text-right tabular-nums text-muted">
              {quote.unwrap().subtotal.format()}
            </dd>
            {quote.unwrap().discount && (
              <>
                <dt className="text-muted">
                  {t('discountLine', {
                    name: lang === 'th' ? quote.unwrap().discount!.preset.nameTh : quote.unwrap().discount!.preset.nameEn,
                  })}
                </dt>
                <dd data-testid="discount" className="text-right tabular-nums text-muted">
                  −{quote.unwrap().discount!.amount.format()}
                </dd>
              </>
            )}
            <dt className="font-bold">{t('total')}</dt>
            <dd data-testid="total" className="text-right text-xl font-bold tabular-nums text-accent">
              {quote.unwrap().total.format()}
            </dd>
          </dl>
        )}
        <button
          type="button"
          disabled={!quote.ok || place.isPending}
          onClick={submit}
          className="mt-3 w-full rounded-xl bg-accent py-2.5 font-bold text-white hover:bg-accent-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:bg-line disabled:text-muted"
        >
          {place.isPending ? t('placing') : t('placeOrder')}
        </button>
      </div>
    </section>
  );
}
