import { checkVoid } from '../src/order/void-reason';

it('OTHER needs a note', () => expect(checkVoid('OTHER', '  ').errors).toEqual([{ code: 'VOID_NOTE_REQUIRED' }]));
it('OTHER with no note at all needs a note', () => expect(checkVoid('OTHER').errors).toEqual([{ code: 'VOID_NOTE_REQUIRED' }]));
it('trims the note', () => expect(checkVoid('OTHER', ' spilled ').unwrap().note).toBe('spilled'));
it('other reasons need no note', () => expect(checkVoid('OUT_OF_STOCK').unwrap()).toEqual({ reasonCode: 'OUT_OF_STOCK', note: null }));
