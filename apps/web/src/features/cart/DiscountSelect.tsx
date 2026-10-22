import { useTranslation } from 'react-i18next';
import { isPresetEligible, Money, type DiscountPreset, type Lang } from '@coffee/domain';

interface Props {
  presets: DiscountPreset[] | undefined;
  baseSubtotal: Money | null;
  value: string | null;
  onChange: (code: string | null) => void;
}

/** Discount dropdown: presets below their minimum spend stay visible but disabled (R§9.1, D§8). */
export function DiscountSelect({ presets, baseSubtotal, value, onChange }: Props) {
  const { t, i18n } = useTranslation('cart');
  const lang: Lang = i18n.language === 'th' ? 'th' : 'en';
  const known = presets?.some((p) => p.code === value) ?? false;
  return (
    <label className="mb-3 flex items-center justify-between gap-3 text-sm">
      <span className="font-medium">{t('discount')}</span>
      <select
        value={known ? (value ?? '') : ''}
        disabled={presets === undefined || baseSubtotal === null}
        onChange={(e) => onChange(e.target.value === '' ? null : e.target.value)}
        className="min-w-0 flex-1 rounded-lg border border-line bg-surface py-1.5 pl-3 pr-8 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent disabled:cursor-not-allowed disabled:text-muted"
      >
        <option value="">{t('noDiscount')}</option>
        {presets?.map((p) => {
          const name = lang === 'th' ? p.nameTh : p.nameEn;
          const eligible = baseSubtotal !== null && isPresetEligible(p, baseSubtotal);
          return (
            <option key={p.code} value={p.code} disabled={!eligible}>
              {eligible || p.minSubtotal === null ? name : `${name} — ${t('minSpend', { amount: Money.of(p.minSubtotal).format() })}`}
            </option>
          );
        })}
      </select>
    </label>
  );
}
