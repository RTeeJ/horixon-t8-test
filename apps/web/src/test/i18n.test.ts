import { ERROR_CODES } from '@coffee/domain';
import en from '../locales/en';
import th from '../locales/th';

function flatten(obj: Record<string, unknown>, prefix = ''): string[] {
  return Object.entries(obj).flatMap(([k, v]) =>
    typeof v === 'object' && v !== null
      ? flatten(v as Record<string, unknown>, `${prefix}${k}.`)
      : [`${prefix}${k}`],
  );
}

describe('locales', () => {
  it('has the same namespaces in en and th', () => {
    expect(Object.keys(th).sort()).toEqual(Object.keys(en).sort());
  });

  for (const ns of Object.keys(en) as (keyof typeof en)[]) {
    it(`${ns}: en and th have equal key sets`, () => {
      expect(flatten(th[ns]).sort()).toEqual(flatten(en[ns]).sort());
    });
  }

  it('has a message for every ERROR_CODE in both languages', () => {
    for (const code of ERROR_CODES) {
      expect(en['error-message-code']).toHaveProperty(code);
      expect(th['error-message-code']).toHaveProperty(code);
    }
  });

  it('Thai values are not copies of English (except language-neutral ones)', () => {
    const same = Object.keys(en['error-message-code']).filter(
      (k) =>
        (en['error-message-code'] as Record<string, string>)[k] ===
        (th['error-message-code'] as Record<string, string>)[k],
    );
    expect(same).toEqual([]);
  });
});
