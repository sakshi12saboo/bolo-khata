import { describe, expect, it } from 'vitest';
import { draftFromSale } from '../../src/domain/bill.js';
import { balanceOf } from '../../src/domain/ledger.js';
import type { Intent } from '../../src/shared/intent.js';
import { addCustomer, addStock, confirmSale, recordPayment } from '../../src/domain/store.js';
import { freshStore, NOW } from './fixtures.js';

const ids = () => {
  let n = 0;
  return () => `t-${++n}`;
};
const maggi = (customer: string | null, mode: 'cash' | 'udhaar' | 'upi'): Extract<Intent, { kind: 'sale' }> => ({
  kind: 'sale',
  items: [{ name: 'maggi', sku: 'maggi', qty: 3, unit: 'pkt', amountRupees: null }],
  customer,
  paymentMode: mode,
});

describe('confirmSale', () => {
  it('records the bill, decrements stock and advances the bill number', () => {
    const s = freshStore();
    const { store, sale } = confirmSale(s, draftFromSale(maggi(null, 'cash'), s), NOW, ids());
    expect(sale).toMatchObject({ kind: 'sale', billNo: s.nextBillNo, totalPaise: 4200, paymentMode: 'cash', ts: NOW });
    expect(store.products.find((p) => p.sku === 'maggi')?.stock).toBe(45);
    expect(store.nextBillNo).toBe(s.nextBillNo + 1);
    expect(store.txns.at(-1)).toBe(sale);
  });

  it('does not mutate the input store', () => {
    const s = freshStore();
    const before = JSON.stringify(s);
    confirmSale(s, draftFromSale(maggi(null, 'cash'), s), NOW, ids());
    expect(JSON.stringify(s)).toBe(before);
  });

  it('raises the udhaar balance of the customer', () => {
    const s = freshStore();
    const was = balanceOf(s, 'c-sharma');
    const { store } = confirmSale(s, draftFromSale(maggi('Sharma ji', 'udhaar'), s), NOW, ids());
    expect(balanceOf(store, 'c-sharma')).toBe(was + 4200);
  });

  it('creates a new customer when the name was not known', () => {
    const s = freshStore();
    const { store, sale } = confirmSale(s, draftFromSale(maggi('Verma ji', 'udhaar'), s), NOW, ids());
    const verma = store.customers.find((c) => c.name === 'Verma ji');
    expect(verma).toBeDefined();
    expect(sale.customerId).toBe(verma?.id);
    expect(balanceOf(store, verma!.id)).toBe(4200);
  });

  it('never takes stock below zero', () => {
    const s = freshStore();
    const d = draftFromSale(maggi(null, 'cash'), s);
    const { store } = confirmSale(s, { ...d, lines: [{ ...d.lines[0]!, qty: 999 }] }, NOW, ids());
    expect(store.products.find((p) => p.sku === 'maggi')?.stock).toBe(0);
  });

  it('refuses an invalid draft', () => {
    const s = freshStore();
    expect(() => confirmSale(s, draftFromSale(maggi(null, 'udhaar'), s), NOW, ids())).toThrow(/needs_customer/);
  });

  it('stores an owner-priced unknown item without touching stock', () => {
    const s = freshStore();
    const d = draftFromSale({ kind: 'sale', items: [{ name: 'Kurkure', sku: null, qty: 2, unit: 'pkt', amountRupees: null }], customer: null, paymentMode: 'cash' }, s);
    const { sale } = confirmSale(s, { ...d, lines: [{ ...d.lines[0]!, unitPricePaise: 2000, needsPrice: false }] }, NOW, ids());
    expect(sale.lines[0]).toMatchObject({ sku: null, name: 'Kurkure', totalPaise: 4000 });
  });
});

describe('recordPayment', () => {
  it('reduces the balance', () => {
    const s = freshStore();
    const was = balanceOf(s, 'c-patil');
    const next = recordPayment(s, 'c-patil', 50000, NOW, ids());
    expect(balanceOf(next, 'c-patil')).toBe(was - 50000);
  });

  it('rejects unknown customers and non-positive amounts', () => {
    const s = freshStore();
    expect(() => recordPayment(s, 'nobody', 100, NOW, ids())).toThrow();
    expect(() => recordPayment(s, 'c-patil', 0, NOW, ids())).toThrow();
  });
});

describe('addStock', () => {
  it('increases stock and logs the delivery', () => {
    const s = freshStore();
    const next = addStock(s, [{ sku: 'tea-tata-250', qty: 10 }], NOW, ids());
    expect(next.products.find((p) => p.sku === 'tea-tata-250')?.stock).toBe(12);
    expect(next.txns.at(-1)).toMatchObject({ kind: 'stock_add', items: [{ sku: 'tea-tata-250', qty: 10 }] });
  });

  it('ignores unknown skus', () => {
    const s = freshStore();
    const next = addStock(s, [{ sku: 'nope', qty: 10 }], NOW, ids());
    expect(next.products).toEqual(s.products);
  });
});

describe('addCustomer', () => {
  it('adds a trimmed customer with a fresh id', () => {
    const s = freshStore();
    const { store, customer } = addCustomer(s, '  Verma ji ', ids());
    expect(customer).toEqual({ id: 't-1', name: 'Verma ji' });
    expect(store.customers).toHaveLength(6);
  });
});
