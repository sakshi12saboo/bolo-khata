import { formatINR } from '../domain/money';
import { todaysSales } from '../domain/queries';
import { startOfDay } from '../domain/time';
import type { SaleTxn, Store } from '../domain/types';
import { formatBillDate } from '../domain/whatsapp';
import { Bi } from './Bi';

export interface Feedback {
  hi: string;
  en: string;
  tone: 'answer' | 'ok' | 'warn' | 'error';
  heard?: string;
  onRetry?: () => void;
}

interface Props {
  store: Store;
  now: number;
  feedback: Feedback | null;
  thinking: boolean;
  onTry: (text: string) => void;
  onOpenBill: (sale: SaleTxn) => void;
}

const TRY = [
  'do kilo atta aur ek Amul doodh, Sharma ji ke khate mein likh do',
  'Gupta aunty ne 300 jama kiye',
  'Sharma ji ka kitna baaki hai?',
  'kya khatam ho raha hai?',
  'don kilo sakhar ani ek Parle-G dya, GPay',
  '20 packet Maggi aaya hai',
];

export function HomeScreen({ store, now, feedback, thinking, onTry, onOpenBill }: Props) {
  const sales = todaysSales(store, now);
  const total = sales.reduce((s, t) => s + t.totalPaise, 0);
  const udhaar = sales.filter((s) => s.paymentMode === 'udhaar').reduce((s, t) => s + t.totalPaise, 0);
  const from = startOfDay(now);
  const jama = store.txns.filter((t) => t.kind === 'payment' && t.ts >= from).reduce((s, t) => s + (t.kind === 'payment' ? t.amountPaise : 0), 0);
  const recent = [...sales].reverse().slice(0, 8);

  return (
    <div className="home">
      <section className="today" aria-label="Today">
        <div className="today__main">
          <Bi hi="आज की बिक्री" en="Sold today" />
          <strong data-testid="today-total">{formatINR(total)}</strong>
        </div>
        <dl className="today__facts">
          <div>
            <dt>Bills</dt>
            <dd>{sales.length}</dd>
          </div>
          <div>
            <dt>Udhaar given</dt>
            <dd className="red">{formatINR(udhaar)}</dd>
          </div>
          <div>
            <dt>Jama received</dt>
            <dd className="green">{formatINR(jama)}</dd>
          </div>
        </dl>
      </section>

      <div aria-live="polite" className="feedback-slot">
        {thinking ? (
          <div className="feedback feedback--thinking">
            <span className="dots" aria-hidden="true" />
            <Bi hi="समझ रहे हैं…" en="Understanding what you said" />
          </div>
        ) : feedback ? (
          <div className={`feedback feedback--${feedback.tone}`} data-testid="feedback">
            {feedback.heard ? <q className="heard">{feedback.heard}</q> : null}
            <p className="feedback__hi" lang="hi">
              {feedback.hi}
            </p>
            <p className="feedback__en">{feedback.en}</p>
            {feedback.onRetry ? (
              <button type="button" className="btn btn--small" onClick={feedback.onRetry}>
                फिर भेजें / Try again
              </button>
            ) : null}
          </div>
        ) : null}
      </div>

      {recent.length ? (
        <section aria-label="Today's bills">
          <h2 className="section-title">
            <Bi hi="आज के बिल" en="Today's bills" />
          </h2>
          <ul className="bills">
            {recent.map((s) => {
              const c = store.customers.find((x) => x.id === s.customerId);
              return (
                <li key={s.id}>
                  <button type="button" className="bill-row" onClick={() => onOpenBill(s)}>
                    <span className="bill-row__no">#{s.billNo}</span>
                    <span className="bill-row__who">
                      {c?.name ?? 'Walk-in'}
                      <small>
                        {s.lines.length} item{s.lines.length === 1 ? '' : 's'}, {formatBillDate(s.ts).split(', ')[1]}
                      </small>
                    </span>
                    <span className={`tag tag--${s.paymentMode}`}>{s.paymentMode === 'udhaar' ? 'Udhaar' : s.paymentMode === 'upi' ? 'UPI' : 'Cash'}</span>
                    <span className="bill-row__amt">{formatINR(s.totalPaise)}</span>
                  </button>
                </li>
              );
            })}
          </ul>
        </section>
      ) : (
        <section className="try" aria-label="Try saying">
          <h2 className="section-title">
            <Bi hi="ऐसे बोलकर देखिए" en="Try saying, or tap one" />
          </h2>
          <ul>
            {TRY.map((t) => (
              <li key={t}>
                <button type="button" className="try__chip" onClick={() => onTry(t)}>
                  {t}
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
