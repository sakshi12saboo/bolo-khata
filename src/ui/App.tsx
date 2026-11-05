import { useCallback, useEffect, useRef, useState } from 'react';
import { draftFromSale } from '../domain/bill';
import { stockLinesFromIntent, type StockLine } from '../domain/intake';
import { balanceOf } from '../domain/ledger';
import { matchCustomer } from '../domain/match';
import { formatINR, rupeesToPaise } from '../domain/money';
import { answerQuery } from '../domain/queries';
import type { DraftBill, SaleTxn } from '../domain/types';
import { understand, UnderstandError, type UnderstandInput } from '../lib/api';
import { speak } from '../lib/speak';
import type { UnderstandOk } from '../shared/intent';
import { useKhata } from '../state/useKhata';
import { BillSheet } from './BillSheet';
import { Bi } from './Bi';
import { CommandBar } from './CommandBar';
import { HomeScreen, type Feedback } from './HomeScreen';
import { KhataScreen } from './KhataScreen';
import { MicButton } from './MicButton';
import { PaymentSheet } from './PaymentSheet';
import { SavedSheet } from './SavedSheet';
import { StockScreen } from './StockScreen';
import { StockSheet } from './StockSheet';

type Tab = 'bolo' | 'khata' | 'stock';
type Sheet =
  | { t: 'bill'; draft: DraftBill; heard: string }
  | { t: 'saved'; sale: SaleTxn }
  | { t: 'payment'; customerId: string | null; spokenName: string; amountPaise: number; heard: string }
  | { t: 'stock'; lines: StockLine[]; heard: string };

const TABS: { id: Tab; hi: string; en: string }[] = [
  { id: 'bolo', hi: 'बोलो', en: 'Speak' },
  { id: 'khata', hi: 'खाता', en: 'Ledger' },
  { id: 'stock', hi: 'स्टॉक', en: 'Stock' },
];

const ERRORS: Record<UnderstandError['kind'], { hi: string; en: string }> = {
  offline: { hi: 'इंटरनेट नहीं है। खाता देख सकते हैं, नया बिल लिखकर बाद में भेजिए।', en: 'You are offline. The ledger still works; send the command again when online.' },
  timeout: { hi: 'समझ नहीं आया, फिर से बोलिए।', en: 'That took too long. Please try again.' },
  busy: { hi: 'थोड़ा रुककर फिर बोलिए।', en: 'Too many requests. Wait a moment and try again.' },
  server: { hi: 'समझ नहीं आया, फिर से बोलिए।', en: 'Something went wrong on our side. Please try again.' },
};

export function App() {
  const { store, confirm, pay, receiveStock, reset } = useKhata();
  const [tab, setTab] = useState<Tab>('bolo');
  const [sheet, setSheet] = useState<Sheet | null>(null);
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const [thinking, setThinking] = useState(false);
  const [confirmReset, setConfirmReset] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(id);
  }, []);

  const act = useCallback(
    (r: UnderstandOk) => {
      if (!store) return;
      const heard = r.transcript;
      const intent = r.intent;
      setTab('bolo');
      switch (intent.kind) {
        case 'sale':
          setFeedback(null);
          setSheet({ t: 'bill', draft: draftFromSale(intent, store), heard });
          return;
        case 'payment': {
          const c = matchCustomer(intent.customer, store.customers);
          setFeedback(null);
          setSheet({ t: 'payment', customerId: c?.id ?? null, spokenName: intent.customer, amountPaise: rupeesToPaise(intent.amount), heard });
          return;
        }
        case 'stock_add':
          setFeedback(null);
          setSheet({ t: 'stock', lines: stockLinesFromIntent(intent, store), heard });
          return;
        case 'query': {
          const a = answerQuery(intent, store, Date.now());
          setFeedback({ ...a, tone: 'answer', heard });
          speak(a.hi);
          return;
        }
        default:
          setFeedback({ hi: 'समझ नहीं आया, फिर से बोलिए।', en: "Didn't catch a sale, payment or question. Please say it again.", tone: 'warn', heard });
      }
    },
    [store],
  );

  const send = useCallback(
    async (input: UnderstandInput) => {
      if (!store) return;
      setThinking(true);
      setFeedback(null);
      try {
        act(await understand(input, store));
      } catch (e) {
        const kind = e instanceof UnderstandError ? e.kind : 'server';
        setFeedback({ ...ERRORS[kind], tone: 'error', onRetry: () => void send(input) });
      } finally {
        setThinking(false);
      }
    },
    [store, act],
  );

  if (!store) return <div className="boot">बोलो खाता</div>;

  const onConfirmBill = (d: DraftBill) => {
    const { sale } = confirm(d);
    setSheet({ t: 'saved', sale });
  };

  const onPay = (customerId: string, amountPaise: number) => {
    pay(customerId, amountPaise);
    const c = store.customers.find((x) => x.id === customerId)!;
    const left = balanceOf(store, customerId) - amountPaise;
    setSheet(null);
    setFeedback({
      tone: 'ok',
      hi: `${c.nameHi ?? c.name} से ${formatINR(amountPaise)} जमा। अब ${formatINR(Math.max(0, left))} बाकी।`,
      en: `Recorded ${formatINR(amountPaise)} from ${c.name}. ${left > 0 ? `${formatINR(left)} still due.` : 'Account clear.'}`,
    });
  };

  const onStock = (items: { sku: string; qty: number }[]) => {
    receiveStock(items);
    setSheet(null);
    setFeedback({ tone: 'ok', hi: `${items.length} ${items.length === 1 ? 'चीज़' : 'चीज़ों'} का स्टॉक बढ़ा दिया।`, en: `Stock updated for ${items.length} item${items.length === 1 ? '' : 's'}.` });
  };

  return (
    <div className="app">
      <header className="top">
        <div className="top__brand">
          <span className="top__logo" lang="hi">
            बोलो खाता
          </span>
          <span className="top__shop">{store.shopName}</span>
        </div>
        {confirmReset ? (
          <span className="top__confirm">
            <button type="button" className="chip chip--danger" onClick={() => { reset(); setFeedback(null); setSheet(null); setConfirmReset(false); }}>
              Yes, reset
            </button>
            <button type="button" className="chip" onClick={() => setConfirmReset(false)}>
              Keep
            </button>
          </span>
        ) : (
          <button type="button" className="chip" onClick={() => setConfirmReset(true)}>
            Reset demo
          </button>
        )}
      </header>

      <main className="main" id="main">
        {tab === 'bolo' ? (
          <HomeScreen store={store} now={now} feedback={feedback} thinking={thinking} onTry={(t) => void send({ text: t })} onOpenBill={(sale) => setSheet({ t: 'saved', sale })} />
        ) : tab === 'khata' ? (
          <KhataScreen store={store} onPay={onPay} />
        ) : (
          <StockScreen store={store} />
        )}
      </main>

      <footer className={tab === 'bolo' ? 'dock' : 'dock dock--compact'}>
        <MicButton
          busy={thinking}
          onAudio={(a) => void send({ audio: a.base64, mimeType: a.mimeType })}
          onMicError={(why) => {
            setTab('bolo');
            setFeedback(
              why === 'too-short'
                ? { tone: 'warn', hi: 'बटन दबाए रखिए और बोलिए।', en: 'Keep the button pressed while you speak.' }
                : { tone: 'warn', hi: 'माइक नहीं मिला। नीचे लिखकर बताइए।', en: 'Microphone is blocked or missing. Type your command below.' },
            );
            if (why !== 'too-short') inputRef.current?.focus();
          }}
        />
        <CommandBar busy={thinking} onSubmit={(t) => void send({ text: t })} inputRef={inputRef} />
        <nav className="tabs" aria-label="Sections">
          {TABS.map((t) => (
            <button key={t.id} type="button" className="tab" aria-current={tab === t.id ? 'page' : undefined} onClick={() => setTab(t.id)}>
              <Bi hi={t.hi} en={t.en} />
            </button>
          ))}
        </nav>
      </footer>

      {sheet?.t === 'bill' ? (
        <BillSheet initial={sheet.draft} heard={sheet.heard} store={store} onCancel={() => setSheet(null)} onConfirm={onConfirmBill} />
      ) : sheet?.t === 'saved' ? (
        <SavedSheet sale={sheet.sale} store={store} onDone={() => setSheet(null)} />
      ) : sheet?.t === 'payment' ? (
        <PaymentSheet
          store={store}
          heard={sheet.heard}
          spokenName={sheet.spokenName}
          initialCustomerId={sheet.customerId}
          initialAmountPaise={sheet.amountPaise}
          onCancel={() => setSheet(null)}
          onConfirm={onPay}
        />
      ) : sheet?.t === 'stock' ? (
        <StockSheet store={store} heard={sheet.heard} initial={sheet.lines} onCancel={() => setSheet(null)} onConfirm={onStock} />
      ) : null}
    </div>
  );
}
