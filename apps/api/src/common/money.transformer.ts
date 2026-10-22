import { Money } from '@coffee/domain';
import type { ValueTransformer } from 'typeorm';

/** numeric(12,2) string <-> Money. */
export const moneyTransformer: ValueTransformer = {
  to: (value: Money | null | undefined): string | null | undefined => (value == null ? (value as null | undefined) : value.toString()),
  from: (value: string | null | undefined): Money | null | undefined => (value == null ? (value as null | undefined) : Money.of(value)),
};
