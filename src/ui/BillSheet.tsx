import { useState } from 'react';
import { billTotal, changeDue, draftLineTotal, validateDraft } from '../domain/bill';
import { balanceOf } from '../domain/ledger';
import { formatINR, rupeesToPaise } from '../domain/money';
import type { DraftBill, PaymentMode, Store } from '../domain/types';
import { Bi } from './Bi';
import { Sheet } from './Sheet';
import { Stepper } from './Stepper';

interface Props {
  initial: DraftBill;
  heard: string;
  store: Store;
  onCancel: () => void;
  onConfirm: (d: DraftBill) => void;
}

const MODES: { id: PaymentMode; hi: string; en: string }[] = [
  { id: 'cash', hi: 'नकद', en: 'Cash' },
  { id: 'upi', hi: 'UPI', en: 'Online' },
  { id: 'udhaar', hi: 'उधार', en: 'Udhaar' },
];

export function BillSheet({ initial, heard, store, onCancel, onConfirm }: Props) {
  const [d, setD] = useState(initial);
  const total = billTotal(d);
  const problems = validateDraft(d);
  const change = changeDue(d);
  const hiName = new Map(store.products.map((p) => [p.sku, p.nameHi]));
  const customerValue = d.customerId ?? (d.newCustomerName ? '__new' : '');
  const before = d.customerId ? balanceOf(store, d.customerId) : 0;
  const after = before + (d.paymentMode === 'udhaar' ? total - (d.paidPaise ?? 0) : 0);

  const setLine = (key: string, patch: Partial<DraftBill['lines'][number]>) =>
    setD((x) => ({ ...x, lines: x.lines.map((l) => (l.key === key ? { ...l, ...patch } : l)) }));

  return (
    <Sheet label={`New bill, ${store.nextBillNo}`} onClose={onCancel} tone="slip">
      <header className="slip__head">
        <Bi hi={`बिल नं. ${store.nextBillNo}`} en="New bill" className="slip__title" />
        {heard ? <q className="heard">{heard}</q> : null}
      </header>

      <ul className="slip__lines" aria-label="Items">
        {d.lines.map((l) => (
          <li key={l.key} className={l.sku ? 'line' : 'line line--unknown'}>
            <div className="line__name">
              <span>{l.name}</span>
              {l.sku ? (
                <small lang="hi">{hiName.get(l.sku)}</small>
              ) : (
                <small>Not in your list. Type the price. / लिस्ट में नहीं है, दाम लिखें</small>
              )}
            </div>
            <Stepper qty={l.qty} unit={l.unit} label={l.name} onChange={(qty) => setLine(l.key, { qty })} />
            {l.sku ? (
              <span className="line__rate">@ {formatINR(l.unitPricePaise ?? 0)}</span>
            ) : (
              <label className="line__price">
                <span className="sr-only">Price of {l.name} in rupees</span>₹
                <input
                  inputMode="decimal"
                  placeholder="दाम"
                  value={l.unitPricePaise ? String(l.unitPricePaise / 100) : ''}
                  onChange={(e) => {
                    const v = Number(e.target.value);
                    setLine(l.key, { unitPricePaise: v > 0 ? rupeesToPaise(v) : null });
                  }}
                />
              </label>
            )}
            <span className="line__total">{formatINR(draftLineTotal(l))}</span>
            <button
              type="button"
              className="line__remove"
              aria-label={`Remove ${l.name}`}
              onClick={() => setD((x) => ({ ...x, lines: x.lines.filter((y) => y.key !== l.key) }))}
            >
              ×
            </button>
          </li>
        ))}
      </ul>

      <div className="slip__total">
        <Bi hi="कुल" en="Total" />
        <strong data-testid="bill-total">{formatINR(total)}</strong>
      </div>

      <fieldset className="modes">
        <legend className="sr-only">Payment mode</legend>
        {MODES.map((m) => (
          <button
            key={m.id}
            type="button"
            aria-pressed={d.paymentMode === m.id}
            className={`mode mode--${m.id}`}
            onClick={() => setD((x) => ({ ...x, paymentMode: m.id }))}
          >
            <Bi hi={m.hi} en={m.en} />
          </button>
        ))}
      </fieldset>

      <label className="field">
        <Bi hi="ग्राहक" en="Customer" />
        <select
          value={customerValue}
          onChange={(e) => {
            const v = e.target.value;
            setD((x) => ({ ...x, customerId: v && v !== '__new' ? v : null, newCustomerName: v === '__new' ? initial.newCustomerName : null }));
          }}
        >
          <option value="">{d.paymentMode === 'udhaar' ? 'Choose a customer / ग्राहक चुनें' : 'Walk-in customer / बिना नाम'}</option>
          {initial.newCustomerName ? <option value="__new">New: {initial.newCustomerName}</option> : null}
          {store.customers.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </label>

      {d.paymentMode === 'udhaar' && (d.customerId || d.newCustomerName) ? (
        <p className="ledger-note">
          {d.paidPaise ? <>Paid now {formatINR(d.paidPaise)}, recorded as jama. </> : null}
          Baaki was {formatINR(before)}, now <strong>{formatINR(after)}</strong>
        </p>
      ) : null}
      {change != null && change > 0 ? (
        <p className="ledger-note">
          Received {formatINR(d.paidPaise ?? 0)}. <strong>Return {formatINR(change)}</strong> / {formatINR(change)} वापस दें
        </p>
      ) : null}

      {problems.length ? (
        <p className="problem" role="status">
          {problems.includes('needs_price') ? 'Add a price for the highlighted item. ' : ''}
          {problems.includes('needs_customer') ? 'Udhaar needs a customer name. ' : ''}
          {problems.includes('empty') ? 'The bill is empty. ' : ''}
        </p>
      ) : null}

      <div className="actions">
        <button type="button" className="btn btn--ghost" onClick={onCancel}>
          <Bi hi="रद्द करें" en="Cancel" />
        </button>
        <button type="button" className="btn btn--primary" disabled={problems.length > 0} onClick={() => onConfirm(d)}>
          <Bi hi="बिल पक्का करें" en="Save bill" />
        </button>
      </div>
    </Sheet>
  );
}
