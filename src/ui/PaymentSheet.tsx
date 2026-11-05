import { useState } from 'react';
import { balanceOf } from '../domain/ledger';
import { formatINR, rupeesToPaise } from '../domain/money';
import type { Store } from '../domain/types';
import { Bi } from './Bi';
import { Sheet } from './Sheet';

interface Props {
  store: Store;
  heard: string;
  spokenName: string;
  initialCustomerId: string | null;
  initialAmountPaise: number;
  onCancel: () => void;
  onConfirm: (customerId: string, amountPaise: number) => void;
}

export function PaymentSheet({ store, heard, spokenName, initialCustomerId, initialAmountPaise, onCancel, onConfirm }: Props) {
  const [customerId, setCustomerId] = useState(initialCustomerId ?? '');
  const [rupees, setRupees] = useState(String(initialAmountPaise / 100));
  const amount = rupeesToPaise(Number(rupees) || 0);
  const before = customerId ? balanceOf(store, customerId) : 0;
  const valid = Boolean(customerId) && amount > 0;
  return (
    <Sheet label="Record payment" onClose={onCancel}>
      <header className="slip__head">
        <Bi hi="जमा" en="Payment received" className="slip__title" />
        {heard ? <q className="heard">{heard}</q> : null}
      </header>
      {!initialCustomerId ? (
        <p className="problem">No khata named “{spokenName}”. Pick the right customer.</p>
      ) : null}
      <label className="field">
        <Bi hi="ग्राहक" en="Customer" />
        <select value={customerId} onChange={(e) => setCustomerId(e.target.value)}>
          <option value="">Choose / चुनें</option>
          {store.customers.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </label>
      <label className="field">
        <Bi hi="रकम" en="Amount (₹)" />
        <input inputMode="decimal" value={rupees} onChange={(e) => setRupees(e.target.value)} />
      </label>
      {customerId ? (
        <p className="ledger-note">
          Baaki was {formatINR(before)}, now <strong>{formatINR(before - amount)}</strong>
        </p>
      ) : null}
      <div className="actions">
        <button type="button" className="btn btn--ghost" onClick={onCancel}>
          <Bi hi="रद्द करें" en="Cancel" />
        </button>
        <button type="button" className="btn btn--jama" disabled={!valid} onClick={() => onConfirm(customerId, amount)}>
          <Bi hi="जमा करें" en="Record payment" />
        </button>
      </div>
    </Sheet>
  );
}
