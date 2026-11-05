import { formatINR } from '../domain/money';
import type { SaleTxn, Store } from '../domain/types';
import { formatBillText, whatsappUrl } from '../domain/whatsapp';
import { Bi } from './Bi';
import { Sheet } from './Sheet';

interface Props {
  sale: SaleTxn;
  store: Store;
  onDone: () => void;
}

export function SavedSheet({ sale, store, onDone }: Props) {
  const customer = store.customers.find((c) => c.id === sale.customerId);
  const share = () => window.open(whatsappUrl(formatBillText(sale, store), customer?.phone), '_blank', 'noopener');
  return (
    <Sheet label={`Bill ${sale.billNo} saved`} onClose={onDone} tone="slip">
      <div className="saved" role="status">
        <div className="saved__stamp" aria-hidden="true">
          पक्का
        </div>
        <Bi hi={`बिल नं. ${sale.billNo} सेव हो गया`} en={`Bill ${sale.billNo} saved`} className="slip__title" />
        <strong className="saved__total">{formatINR(sale.totalPaise)}</strong>
        <p className="muted">
          {sale.paymentMode === 'udhaar' ? `Udhaar in ${customer?.name ?? 'khata'}` : sale.paymentMode === 'upi' ? 'Paid by UPI' : 'Paid in cash'}. Stock updated.
        </p>
      </div>
      <div className="actions">
        <button type="button" className="btn btn--whatsapp" onClick={share}>
          <Bi hi="WhatsApp पर भेजें" en="Send on WhatsApp" />
        </button>
        <button type="button" className="btn btn--ghost" onClick={onDone}>
          <Bi hi="अगला ग्राहक" en="Next customer" />
        </button>
      </div>
    </Sheet>
  );
}
