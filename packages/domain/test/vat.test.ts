import { Money } from '../src/money/money';
import { extractVat } from '../src/money/vat';

it.each([['115.00', '7.52', '107.48'], ['180.00', '11.78', '168.22'], ['200.00', '13.08', '186.92'], ['0.00', '0.00', '0.00']])(
  'extracts 7%% VAT from %s', (total, vat, before) => {
    const r = extractVat(Money.of(total), 700);
    expect([r.vat.toString(), r.beforeVat.toString()]).toEqual([vat, before]);
  });
it('rounds an exact half satang up', () => expect(extractVat(Money.of('0.01'), 10000).vat.toString()).toBe('0.01'));
