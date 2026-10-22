import type { LineInput } from '@coffee/domain';

export type Recipe = Omit<LineInput, 'quantity'>;

/** `key` is the English description: canonical, so identical recipes merge (R§7, A15). */
export interface CartLine {
  key: string;
  recipe: Recipe;
  quantity: number;
}

export type CartAction =
  | { type: 'add'; key: string; recipe: Recipe }
  | { type: 'setQuantity'; key: string; quantity: number }
  | { type: 'remove'; key: string }
  | { type: 'clear' };

export function cartReducer(state: CartLine[], action: CartAction): CartLine[] {
  switch (action.type) {
    case 'add':
      return state.some((l) => l.key === action.key)
        ? state.map((l) => (l.key === action.key ? { ...l, quantity: l.quantity + 1 } : l))
        : [...state, { key: action.key, recipe: action.recipe, quantity: 1 }];
    case 'setQuantity':
      return action.quantity < 1
        ? state.filter((l) => l.key !== action.key)
        : state.map((l) => (l.key === action.key ? { ...l, quantity: action.quantity } : l));
    case 'remove':
      return state.filter((l) => l.key !== action.key);
    case 'clear':
      return [];
  }
}
