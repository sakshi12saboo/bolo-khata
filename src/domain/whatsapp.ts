import { balanceOf } from './ledger.js';
import { formatINR } from './money.js';
import type { SaleTxn, Store } from './types.js';
import { formatQty } from './units.js';

const MODE_LABEL = { cash: 'Cash', upi: 'UPI', udhaar: 'Udhaar' } as const;

export function formatBillDate(ts: number): string {
  const parts = new Intl.DateTimeFormat('en-IN', {
    timeZone: 'Asia/Kolkata', day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true,
  }).formatToParts(new Date(ts));
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? '';
  return `${get('day')} ${get('month')} ${get('year')}, ${get('hour')}:${get('minute')} ${get('dayPeriod').toLowerCase()}`;
}

export function formatBillText(sale: SaleTxn, store: Store): string {
  const out = [`*${store.shopName}*`, `Bill #${sale.billNo} | ${formatBillDate(sale.ts)}`, ''];
  for (const l of sale.lines) {
    const qty = l.unit === 'pc' ? `${formatQty(l.qty, l.unit)}` : formatQty(l.qty, l.unit);
    out.push(l.name, `   ${qty} x ${formatINR(l.unitPricePaise)} = ${formatINR(l.totalPaise)}`);
  }
  out.push('------------------------', `*Total: ${formatINR(sale.totalPaise)}*`);
  const customer = store.customers.find((c) => c.id === sale.customerId);
  out.push(`Payment: ${MODE_LABEL[sale.paymentMode]}${customer ? ` (${customer.name})` : ''}`);
  if (sale.paymentMode === 'udhaar' && customer) out.push(`Total baaki: ${formatINR(balanceOf(store, customer.id))}`);
  out.push('', 'Dhanyavaad! Bill made with Bolo Khata.');
  return out.join('\n');
}

export function whatsappUrl(text: string, phone?: string): string {
  const digits = (phone ?? '').replace(/\D/g, '');
  const target = digits.length === 10 ? `91${digits}` : digits.length === 12 && digits.startsWith('91') ? digits : '';
  return `https://wa.me/${target}?text=${encodeURIComponent(text)}`;
}
