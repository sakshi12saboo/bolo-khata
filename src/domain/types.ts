/** All money is integer paise. All quantities are in the product's own unit. */
export type Unit = 'kg' | 'g' | 'l' | 'ml' | 'pc' | 'pkt' | 'dozen';

export interface Product {
  sku: string;
  name: string;
  nameHi: string;
  unit: Unit;
  pricePaise: number;
  stock: number;
  lowAt: number;
  aliases?: string[];
}

export interface Customer {
  id: string;
  name: string;
  nameHi?: string;
  phone?: string;
}

export type PaymentMode = 'cash' | 'upi' | 'udhaar';

export interface SaleLine {
  sku: string | null;
  name: string;
  qty: number;
  unit: Unit;
  unitPricePaise: number;
  totalPaise: number;
}

export interface SaleTxn {
  kind: 'sale';
  id: string;
  billNo: number;
  ts: number;
  lines: SaleLine[];
  totalPaise: number;
  customerId: string | null;
  paymentMode: PaymentMode;
}

export interface PaymentTxn {
  kind: 'payment';
  id: string;
  ts: number;
  customerId: string;
  amountPaise: number;
}

export interface StockTxn {
  kind: 'stock_add';
  id: string;
  ts: number;
  items: { sku: string; qty: number }[];
}

export type Txn = SaleTxn | PaymentTxn | StockTxn;

export interface Store {
  version: 1;
  shopName: string;
  products: Product[];
  customers: Customer[];
  txns: Txn[];
  nextBillNo: number;
}

/** A line on the bill sheet before the owner confirms it. */
export interface DraftLine {
  key: string;
  sku: string | null;
  name: string;
  qty: number;
  unit: Unit;
  unitPricePaise: number | null;
  /** true when the item is not in the catalogue and the owner must type a price */
  needsPrice: boolean;
}

export interface DraftBill {
  lines: DraftLine[];
  customerId: string | null;
  /** name as heard, when it did not match an existing customer */
  newCustomerName: string | null;
  paymentMode: PaymentMode;
  /** cash handed over (cash/upi: change is due; udhaar: recorded as a repayment) */
  paidPaise: number | null;
}

export interface Bilingual {
  hi: string;
  en: string;
}
