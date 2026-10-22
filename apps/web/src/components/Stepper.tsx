import { Minus, Plus } from 'lucide-react';

type Props = {
  value: number;
  decreaseLabel: string;
  increaseLabel: string;
  countLabel: string;
  canDecrease: boolean;
  canIncrease: boolean;
  onDecrease(): void;
  onIncrease(): void;
};

const button =
  'flex size-8 items-center justify-center rounded-full border border-accent text-accent ' +
  'hover:bg-accent-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent ' +
  'disabled:cursor-not-allowed disabled:border-line disabled:text-muted disabled:opacity-50 disabled:hover:bg-transparent';

export function Stepper(p: Props) {
  return (
    <div className="inline-flex items-center gap-3">
      <button
        type="button"
        aria-label={p.decreaseLabel}
        disabled={!p.canDecrease}
        onClick={p.onDecrease}
        className={button}
      >
        <Minus aria-hidden="true" className="size-4" />
      </button>
      <output aria-label={p.countLabel} className="min-w-6 text-center font-semibold tabular-nums">
        {p.value}
      </output>
      <button
        type="button"
        aria-label={p.increaseLabel}
        disabled={!p.canIncrease}
        onClick={p.onIncrease}
        className={button}
      >
        <Plus aria-hidden="true" className="size-4" />
      </button>
    </div>
  );
}
