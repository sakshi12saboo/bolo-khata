// Live intent-accuracy eval: node scripts/eval.ts   (BASE_URL defaults to the local dev server)
import { mkdirSync, writeFileSync } from 'node:fs';
import { readFileSync } from 'node:fs';
import { BASE_URL, context } from './context.ts';

const casesFile = process.env.CASES ?? new URL('./eval-cases.json', import.meta.url).pathname;
const cases: { lang: string; text: string; expect: Expect }[] = JSON.parse(readFileSync(casesFile, 'utf8'));

interface Expect {
  kind: string;
  query?: string;
  skus?: (string | null)[];
  customer?: string | null;
  paymentMode?: string;
  amount?: number;
  paidRupees?: number;
  qty?: Record<string, number>;
}

const norm = (s: unknown) => String(s ?? '').toLowerCase();

function check(expect: Expect, intent: Record<string, any>) {
  const intentOk = intent.kind === expect.kind && (expect.query === undefined || intent.query === expect.query);
  const misses: string[] = [];
  if (!intentOk) misses.push(`intent ${intent.kind}${intent.query ? `/${intent.query}` : ''}`);
  if (expect.skus) {
    const got = (intent.items ?? []).map((i: any) => i.sku ?? null).sort();
    const want = [...expect.skus].sort();
    if (JSON.stringify(got) !== JSON.stringify(want)) misses.push(`skus ${JSON.stringify(got)}`);
  }
  if (expect.customer !== undefined) {
    const ok = expect.customer === null ? intent.customer == null : norm(intent.customer).includes(expect.customer);
    if (!ok) misses.push(`customer ${intent.customer}`);
  }
  if (expect.paymentMode && intent.paymentMode !== expect.paymentMode) misses.push(`mode ${intent.paymentMode}`);
  if (expect.amount !== undefined && intent.amount !== expect.amount) misses.push(`amount ${intent.amount}`);
  for (const [sku, q] of Object.entries(expect.qty ?? {})) {
    const got = (intent.items ?? []).find((i: any) => i.sku === sku);
    if (!got || got.qty !== q) misses.push(`qty ${sku}=${got?.qty} ${got?.unit ?? ''}`);
  }
  if (expect.paidRupees !== undefined && intent.paidRupees !== expect.paidRupees) misses.push(`paid ${intent.paidRupees}`);
  return { intentOk, fieldsOk: misses.length === 0, misses };
}

const results = [];
let intentPass = 0;
let fieldPass = 0;
const latencies: number[] = [];
console.log(`Eval against ${BASE_URL}/api/understand (${cases.length} utterances)\n`);
for (const [i, c] of cases.entries()) {
  const t0 = performance.now();
  let intent: Record<string, any> = { kind: 'error' };
  let note = '';
  try {
    const res = await fetch(`${BASE_URL}/api/understand`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ text: c.text, context }),
    });
    const body = await res.json();
    if (body.ok) intent = body.intent;
    else note = `HTTP ${res.status} ${body.error}`;
  } catch (e) {
    note = String(e);
  }
  const ms = Math.round(performance.now() - t0);
  latencies.push(ms);
  const r = check(c.expect, intent);
  if (r.intentOk) intentPass++;
  if (r.fieldsOk) fieldPass++;
  results.push({ ...c, got: intent, ...r, ms, note });
  const mark = r.fieldsOk ? 'PASS ' : r.intentOk ? 'INTENT' : 'FAIL ';
  console.log(`${String(i + 1).padStart(2)} ${mark} ${String(ms).padStart(5)}ms [${c.lang}] ${c.text}${r.misses.length ? `\n      -> ${r.misses.join('; ')}` : ''}${note ? `\n      -> ${note}` : ''}`);
}

const pct = (n: number) => `${((100 * n) / cases.length).toFixed(1)}%`;
latencies.sort((a, b) => a - b);
const summary = {
  baseUrl: BASE_URL,
  model: process.env.GEMINI_MODEL || 'server default (gemini-3.5-flash unless GEMINI_MODEL is set on the server)',
  at: new Date().toISOString(),
  total: cases.length,
  intentAccuracy: pct(intentPass),
  fullFieldAccuracy: pct(fieldPass),
  medianMs: latencies[Math.floor(latencies.length / 2)],
};
console.log(`\nIntent accuracy: ${intentPass}/${cases.length} = ${summary.intentAccuracy}`);
console.log(`All fields correct (intent + items + customer + mode + amount): ${fieldPass}/${cases.length} = ${summary.fullFieldAccuracy}`);
console.log(`Median latency: ${summary.medianMs} ms`);
// GEMINI_MODEL here only labels the output file; the server decides which model it calls.
const set = casesFile.includes('holdout') ? 'holdout' : 'main';
const tag = (process.env.GEMINI_MODEL || 'default').replace(/[^a-z0-9.-]/gi, '_');
mkdirSync(new URL('../docs/eval/', import.meta.url), { recursive: true });
writeFileSync(new URL(`../docs/eval/${tag}-${set}.json`, import.meta.url), JSON.stringify({ summary, results }, null, 2));
