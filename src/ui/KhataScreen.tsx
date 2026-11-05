import { useState } from 'react';
import { allBalances, balanceOf, customerHistory, totalOutstanding } from '../domain/ledger';
import { formatINR, rupeesToPaise } from '../domain/money';
import type { Store } from '../domain/types';
import { formatBillDate, formatReminderText, whatsappUrl } from '../domain/whatsapp';
import { Bi } from './Bi';

interface Props {
  store: Store;
  onPay: (customerId: string, amountPaise: number) => void;
}

export function KhataScreen({ store, onPay }: Props) {
  const [open, setOpen] = useState<string | null>(null);
  const rows = allBalances(store);
  return (
    <div className="khata">
      <section className="khata__total">
        <Bi hi="कुल उधार बाकी" en="Total udhaar to collect" />
        <strong data-testid="khata-total">{formatINR(totalOutstanding(store))}</strong>
      </section>
      <ul className="ledger" aria-label="Customer balances">
        {rows.map(({ customer, balancePaise, lastTs }) => (
          <li key={customer.id} className={open === customer.id ? 'ledger__row ledger__row--open' : 'ledger__row'}>
            <button
              type="button"
              className="ledger__head"
              aria-expanded={open === customer.id}
              onClick={() => setOpen((o) => (o === customer.id ? null : customer.id))}
            >
              <span className="ledger__name">
                {customer.name}
                {customer.nameHi ? <small lang="hi">{customer.nameHi}</small> : null}
              </span>
              <span className="ledger__last">{lastTs ? formatBillDate(lastTs).split(',')[0] : 'New'}</span>
              <span className={balancePaise > 0 ? 'ledger__bal red' : 'ledger__bal green'} data-testid={`balance-${customer.name}`}>
                {balancePaise >= 0 ? formatINR(balancePaise) : `${formatINR(-balancePaise)} adv`}
              </span>
            </button>
            {open === customer.id ? <CustomerDetail store={store} customerId={customer.id} onPay={onPay} /> : null}
          </li>
        ))}
      </ul>
    </div>
  );
}

function CustomerDetail({ store, customerId, onPay }: { store: Store; customerId: string; onPay: Props['onPay'] }) {
  const [rupees, setRupees] = useState('');
  const customer = store.customers.find((c) => c.id === customerId)!;
  const bal = balanceOf(store, customerId);
  const history = customerHistory(store, customerId).slice(0, 12);
  const amount = rupeesToPaise(Number(rupees) || 0);
  return (
    <div className="detail">
      <form
        className="detail__pay"
        onSubmit={(e) => {
          e.preventDefault();
          if (amount > 0) {
            onPay(customerId, amount);
            setRupees('');
          }
        }}
      >
        <label>
          <span className="sr-only">Amount received from {customer.name}</span>
          <input inputMode="decimal" placeholder="₹ जमा रकम" value={rupees} onChange={(e) => setRupees(e.target.value)} />
        </label>
        <button type="submit" className="btn btn--jama btn--small" disabled={amount <= 0}>
          जमा करें / Record
        </button>
      </form>
      {bal > 0 ? (
        <a className="reminder" href={whatsappUrl(formatReminderText(customer, bal, store.shopName), customer.phone)} target="_blank" rel="noopener noreferrer">
          WhatsApp reminder bhejein
        </a>
      ) : null}
      <ol className="history" aria-label={`${customer.name} history`}>
        {history.map((t) => (
          <li key={t.id}>
            <span className="history__date">{formatBillDate(t.ts).split(',')[0]}</span>
            {t.kind === 'sale' ? (
              <>
                <span className="history__what">
                  Bill #{t.billNo}
                  {t.paymentMode !== 'udhaar' ? ` (${t.paymentMode === 'upi' ? 'UPI' : 'cash'})` : ''}
                </span>
                <span className={t.paymentMode === 'udhaar' ? 'red' : 'muted'}>{formatINR(t.totalPaise)}</span>
              </>
            ) : t.kind === 'payment' ? (
              <>
                <span className="history__what">Jama</span>
                <span className="green">−{formatINR(t.amountPaise)}</span>
              </>
            ) : null}
          </li>
        ))}
      </ol>
    </div>
  );
}
