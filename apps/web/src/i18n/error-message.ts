import type { TFunction } from 'i18next';
import { ERROR_CODES, type ErrorCode } from '@coffee/domain';

const KNOWN = new Set<string>(ERROR_CODES);

/** Translated message for an API error code; unknown codes fall back to INTERNAL (R§15). */
export function errorMessage(
  t: TFunction,
  code: string,
  params?: Record<string, string | number>,
): string {
  const safe: ErrorCode = KNOWN.has(code) ? (code as ErrorCode) : 'INTERNAL';
  return t(`error-message-code:${safe}`, params ?? {});
}
