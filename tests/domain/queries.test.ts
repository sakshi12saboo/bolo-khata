import { describe, expect, it } from 'vitest';
import { draftFromSale } from '../../src/domain/bill.js';
import { answerQuery, toSpeech } from '../../src/domain/queries.js';
import { confirmSale } from '../../src/domain/store.js';
import { freshStore, NOW } from './fixtures.js';

const id = (() => { let n = 0; return () => `q-${++n}`; })();

describe('answerQuery', () => {
  it('says nothing was sold on a fresh day', () => {
    const a = answerQuery({ kind: 'query', query: 'sales_today', customer: null }, freshStore(), NOW);
    expect(a.en).toBe('No sales yet today.');
  });

  it('sums only today\'s bills', () => {
    let s = freshStore();
    const d = draftFromSale({ kind: 'sale', items: [{ name: 'maggi', sku: 'maggi', qty: 5, unit: 'pkt', amountRupees: null }], customer: null, paymentMode: 'cash' }, s);
    s = confirmSale(s, d, NOW, id).store;
    s = confirmSale(s, d, NOW, id).store;
    const a = answerQuery({ kind: 'query', query: 'sales_today', customer: null }, s, NOW);
    expect(a.en).toBe("Today's sales: ₹140 across 2 bills.");
    expect(a.hi).toBe('आज की बिक्री ₹140, 2 बिल।');
  });

  it('answers a named customer balance', () => {
    const a = answerQuery({ kind: 'query', query: 'customer_balance', customer: 'sharma' }, freshStore(), NOW);
    expect(a.en).toBe('Sharma ji owes ₹581.');
    expect(a.hi).toBe('शर्मा जी का ₹581 बाकी है।');
    expect(a.customerId).toBe('c-sharma');
  });

  it('reports an advance when the customer has overpaid', () => {
    const a = answerQuery({ kind: 'query', query: 'customer_balance', customer: 'Ramesh' }, freshStore(), NOW);
    expect(a.en).toBe('Ramesh Bhai owes nothing and has ₹20 in advance.');
    expect(a.hi).toBe('रमेश भाई का कुछ बाकी नहीं, ₹20 एडवांस जमा है।');
  });

  it('says when a customer owes exactly nothing', () => {
    const s = freshStore();
    const a = answerQuery({ kind: 'query', query: 'customer_balance', customer: 'Gupta' }, { ...s, txns: [] }, NOW);
    expect(a.en).toBe('Gupta Aunty owes nothing.');
  });

  it('says when no such customer exists', () => {
    const a = answerQuery({ kind: 'query', query: 'customer_balance', customer: 'Verma' }, freshStore(), NOW);
    expect(a.en).toBe('No account found for Verma.');
  });

  it('gives total udhaar when no customer is named', () => {
    const a = answerQuery({ kind: 'query', query: 'customer_balance', customer: null }, freshStore(), NOW);
    expect(a.en).toMatch(/^Total udhaar outstanding: ₹[\d,]+ from \d customers\.$/);
  });

  it('lists low stock items', () => {
    const a = answerQuery({ kind: 'query', query: 'low_stock', customer: null }, freshStore(), NOW);
    expect(a.en).toBe('3 items running low: Tata Tea Premium 250 g, Masoor Dal, Amul Dahi 400 g.');
    expect(a.hi).toBe('3 चीज़ें कम हैं: टाटा चाय पत्ती, मसूर दाल, अमूल दही।');
  });
});

describe('toSpeech', () => {
  it('reads rupee amounts the way a person says them', () => {
    expect(toSpeech('शर्मा जी का ₹1,240 बाकी है।')).toBe('शर्मा जी का 1240 रुपये बाकी है।');
  });
});
