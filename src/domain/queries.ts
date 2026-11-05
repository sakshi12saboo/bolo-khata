import type { Intent } from '../shared/intent.js';
import { allBalances, balanceOf, totalOutstanding } from './ledger.js';
import { matchCustomer } from './match.js';
import { formatINR } from './money.js';
import { lowStock } from './stock.js';
import { startOfDay } from './time.js';
import type { Bilingual, SaleTxn, Store } from './types.js';

type QueryIntent = Extract<Intent, { kind: 'query' }>;
export interface Answer extends Bilingual {
  customerId?: string;
}

export function todaysSales(store: Store, now: number): SaleTxn[] {
  const from = startOfDay(now);
  return store.txns.filter((t): t is SaleTxn => t.kind === 'sale' && t.ts >= from && t.ts <= now + 60_000);
}

export function answerQuery(q: QueryIntent, store: Store, now: number): Answer {
  if (q.query === 'sales_today') {
    const sales = todaysSales(store, now);
    if (sales.length === 0) return { hi: 'आज अभी तक कोई बिक्री नहीं हुई।', en: 'No sales yet today.' };
    const total = formatINR(sales.reduce((s, t) => s + t.totalPaise, 0));
    const n = sales.length;
    return { hi: `आज की बिक्री ${total}, ${n} बिल।`, en: `Today's sales: ${total} across ${n} bill${n === 1 ? '' : 's'}.` };
  }

  if (q.query === 'customer_balance') {
    if (!q.customer) {
      const owing = allBalances(store).filter((b) => b.balancePaise > 0).length;
      const total = formatINR(totalOutstanding(store));
      return {
        hi: `कुल उधार ${total} बाकी है, ${owing} ग्राहकों पर।`,
        en: `Total udhaar outstanding: ${total} from ${owing} customers.`,
      };
    }
    const c = matchCustomer(q.customer, store.customers);
    if (!c) return { hi: `${q.customer} नाम का कोई खाता नहीं मिला।`, en: `No account found for ${q.customer}.` };
    const bal = balanceOf(store, c.id);
    const hiName = c.nameHi ?? c.name;
    if (bal > 0) return { hi: `${hiName} का ${formatINR(bal)} बाकी है।`, en: `${c.name} owes ${formatINR(bal)}.`, customerId: c.id };
    if (bal < 0) {
      const adv = formatINR(-bal);
      return {
        hi: `${hiName} का कुछ बाकी नहीं, ${adv} एडवांस जमा है।`,
        en: `${c.name} owes nothing and has ${adv} in advance.`,
        customerId: c.id,
      };
    }
    return { hi: `${hiName} का कुछ बाकी नहीं है।`, en: `${c.name} owes nothing.`, customerId: c.id };
  }

  const low = lowStock(store);
  if (low.length === 0) return { hi: 'सब सामान स्टॉक में है।', en: 'Nothing is running low.' };
  return {
    hi: `${low.length} चीज़ें कम हैं: ${low.map((p) => p.nameHi).join(', ')}।`,
    en: `${low.length} item${low.length === 1 ? '' : 's'} running low: ${low.map((p) => p.name).join(', ')}.`,
  };
}

/** Make a display sentence sound natural through speechSynthesis. */
export function toSpeech(text: string): string {
  return text.replace(/₹([\d,]+(?:\.\d+)?)/g, (_, n: string) => `${n.replace(/,/g, '')} रुपये`);
}
