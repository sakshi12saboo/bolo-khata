import data from './seed-data.json';
import { lineTotalPaise, rupeesToPaise } from './money.js';
import type { Customer, Product, SaleLine, Store, Txn, Unit } from './types.js';

export const SHOP_NAME = data.shopName;

export function seedProducts(): Product[] {
  return data.products.map((p) => ({
    sku: p.sku,
    name: p.name,
    nameHi: p.nameHi,
    unit: p.unit as Unit,
    pricePaise: rupeesToPaise(p.price),
    stock: p.stock,
    lowAt: p.lowAt,
    aliases: 'aliases' in p ? p.aliases : undefined,
  }));
}

export function seedStore(now: number): Store {
  const products = seedProducts();
  const bySku = new Map(products.map((p) => [p.sku, p]));
  const customers: Customer[] = data.customers.map((c) => ({ ...c }));
  const txns: Txn[] = [];
  let billNo = 1;

  data.history.forEach((h, i) => {
    const ts = now - h.minutesAgo * 60_000;
    const id = `seed-${i + 1}`;
    if (h.type === 'payment') {
      txns.push({ kind: 'payment', id, ts, customerId: h.customer!, amountPaise: rupeesToPaise(h.amount!) });
      return;
    }
    const lines: SaleLine[] = (h.lines ?? []).map(([sku, qty]) => {
      const p = bySku.get(sku as string);
      if (!p) throw new Error(`seed references unknown sku ${String(sku)}`);
      const q = Number(qty);
      return { sku: p.sku, name: p.name, qty: q, unit: p.unit, unitPricePaise: p.pricePaise, totalPaise: lineTotalPaise(q, p.pricePaise) };
    });
    txns.push({
      kind: 'sale',
      id,
      billNo: billNo++,
      ts,
      lines,
      totalPaise: lines.reduce((s, l) => s + l.totalPaise, 0),
      customerId: h.customer ?? null,
      paymentMode: h.mode as 'cash' | 'upi' | 'udhaar',
    });
  });

  return { version: 1, shopName: data.shopName, products, customers, txns, nextBillNo: billNo };
}
