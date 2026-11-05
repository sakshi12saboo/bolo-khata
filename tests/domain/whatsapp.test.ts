import { describe, expect, it } from 'vitest';
import { draftFromSale } from '../../src/domain/bill.js';
import { confirmSale } from '../../src/domain/store.js';
import { formatBillText, whatsappUrl } from '../../src/domain/whatsapp.js';
import { freshStore, NOW } from './fixtures.js';

const id = (() => { let n = 0; return () => `w-${++n}`; })();

describe('formatBillText', () => {
  it('formats an udhaar bill with the running balance', () => {
    const s = freshStore();
    const d = draftFromSale(
      { kind: 'sale', items: [
        { name: 'atta', sku: 'atta-loose', qty: 2, unit: 'kg', amountRupees: null },
        { name: 'doodh', sku: 'milk-taaza-500', qty: 1, unit: 'pkt', amountRupees: null },
      ], customer: 'Sharma ji', paymentMode: 'udhaar' }, s);
    const { store, sale } = confirmSale(s, d, NOW, id);
    expect(formatBillText(sale, store)).toBe(
      [
        '*Annapurna Kirana Store*',
        `Bill #${sale.billNo} | 5 Nov 2026, 10:00 am`,
        '',
        'Gehun Atta (loose)',
        '   2 kg x ₹45 = ₹90',
        'Amul Taaza Milk 500 ml',
        '   1 pkt x ₹28 = ₹28',
        '------------------------',
        '*Total: ₹118*',
        'Payment: Udhaar (Sharma ji)',
        'Total baaki: ₹699',
        '',
        'Dhanyavaad! Bill made with Bolo Khata.',
      ].join('\n'),
    );
  });

  it('labels cash and UPI bills without a balance line', () => {
    const s = freshStore();
    const d = draftFromSale({ kind: 'sale', items: [{ name: 'maggi', sku: 'maggi', qty: 1, unit: 'pkt', amountRupees: null }], customer: null, paymentMode: 'upi' }, s);
    const { store, sale } = confirmSale(s, d, NOW, id);
    const text = formatBillText(sale, store);
    expect(text).toContain('Payment: UPI');
    expect(text).not.toContain('baaki');
  });
});

describe('whatsappUrl', () => {
  it('opens the share picker when there is no phone', () => {
    expect(whatsappUrl('a b&c')).toBe('https://wa.me/?text=a%20b%26c');
  });

  it('targets an Indian mobile number directly', () => {
    expect(whatsappUrl('hi', '98200 11223')).toBe('https://wa.me/919820011223?text=hi');
    expect(whatsappUrl('hi', '+91 98200-11223')).toBe('https://wa.me/919820011223?text=hi');
  });
});
