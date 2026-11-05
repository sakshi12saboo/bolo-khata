import { describe, expect, it } from 'vitest';
import { billTotal, draftFromSale, draftLineTotal, validateDraft } from '../../src/domain/bill.js';
import type { Intent } from '../../src/shared/intent.js';
import { freshStore } from './fixtures.js';

type Sale = Extract<Intent, { kind: 'sale' }>;
const item = (name: string, qty: number, unit = 'pc', sku: string | null = null, amountRupees: number | null = null) => ({
  name, qty, unit, sku, amountRupees,
});
const sale = (items: Sale['items'], customer: string | null = null, paymentMode: Sale['paymentMode'] = 'cash'): Sale => ({
  kind: 'sale', items, customer, paymentMode,
});

describe('draftFromSale', () => {
  const s = freshStore();

  it('prices catalogue items from the catalogue, never from the model', () => {
    const d = draftFromSale(sale([item('atta', 2, 'kilo', 'atta-loose'), item('doodh', 1, 'packet', 'milk-taaza-500')]), s);
    expect(d.lines.map((l) => [l.sku, l.qty, l.unitPricePaise])).toEqual([
      ['atta-loose', 2, 4500],
      ['milk-taaza-500', 1, 2800],
    ]);
    expect(billTotal(d)).toBe(9000 + 2800);
  });

  it('converts grams into kilos for loose items', () => {
    const d = draftFromSale(sale([item('chini', 500, 'gram')]), s);
    expect(d.lines[0]).toMatchObject({ sku: 'sugar', qty: 0.5, unit: 'kg' });
    expect(draftLineTotal(d.lines[0]!)).toBe(2300);
  });

  it('derives quantity from a spoken rupee amount', () => {
    const d = draftFromSale(sale([item('pyaaz', 1, 'kg', null, 50)]), s);
    expect(d.lines[0]).toMatchObject({ sku: 'onion', qty: 1.25 });
    expect(draftLineTotal(d.lines[0]!)).toBe(5000);
  });

  it('flags unknown items for the owner to price instead of dropping them', () => {
    const d = draftFromSale(sale([item('Kurkure', 2, 'packet')]), s);
    expect(d.lines[0]).toMatchObject({ sku: null, name: 'Kurkure', qty: 2, unit: 'pkt', unitPricePaise: null, needsPrice: true });
    expect(billTotal(d)).toBe(0);
  });

  it('uses a spoken amount as the price of an unknown item', () => {
    const d = draftFromSale(sale([item('Kurkure', 1, 'packet', null, 20)]), s);
    expect(d.lines[0]).toMatchObject({ unitPricePaise: 2000, needsPrice: false });
  });

  it('links an existing customer and keeps the payment mode', () => {
    const d = draftFromSale(sale([item('maggi', 2)], 'Sharma ji', 'udhaar'), s);
    expect(d.customerId).toBe('c-sharma');
    expect(d.newCustomerName).toBeNull();
    expect(d.paymentMode).toBe('udhaar');
  });

  it('keeps an unmatched customer name as a new customer', () => {
    const d = draftFromSale(sale([item('maggi', 2)], 'Verma ji', 'udhaar'), s);
    expect(d.customerId).toBeNull();
    expect(d.newCustomerName).toBe('Verma ji');
  });

  it('gives every line a unique key', () => {
    const d = draftFromSale(sale([item('maggi', 1), item('maggi', 1)]), s);
    expect(new Set(d.lines.map((l) => l.key)).size).toBe(2);
  });
});

describe('validateDraft', () => {
  const s = freshStore();

  it('accepts a complete cash bill', () => {
    expect(validateDraft(draftFromSale(sale([item('maggi', 2)]), s))).toEqual([]);
  });

  it('reports an unpriced line', () => {
    expect(validateDraft(draftFromSale(sale([item('Kurkure', 2)]), s))).toContain('needs_price');
  });

  it('requires a customer for udhaar', () => {
    expect(validateDraft(draftFromSale(sale([item('maggi', 2)], null, 'udhaar'), s))).toContain('needs_customer');
  });

  it('rejects an empty bill and zero quantities', () => {
    const d = draftFromSale(sale([item('maggi', 2)]), s);
    expect(validateDraft({ ...d, lines: [] })).toContain('empty');
    expect(validateDraft({ ...d, lines: [{ ...d.lines[0]!, qty: 0 }] })).toContain('bad_qty');
  });
});
