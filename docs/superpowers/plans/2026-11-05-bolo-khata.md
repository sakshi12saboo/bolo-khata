# Bolo Khata Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A local, deploy-ready, voice-first billing and udhaar ledger PWA for kirana stores, per `docs/superpowers/specs/2026-11-05-bolo-khata-design.md`.

**Architecture:** Vite + React + TypeScript SPA. All money, stock and ledger logic is pure TypeScript in `src/domain/` and runs on the device; state persists in IndexedDB (idb-keyval) with a localStorage fallback. One serverless endpoint `POST /api/understand` (Vercel Web-signature function) sends audio or text plus catalogue/customer grounding to Gemini with a JSON response schema, validates with zod and returns a typed intent. The same handler is mounted into Vite dev and preview servers by a small plugin, so the whole app runs locally with no Vercel login.

**Tech Stack:** react 19.3.1, zod 4.6.7, @google/genai 2.30.0, idb-keyval 6.3.0, vite 8.3.5, @vitejs/plugin-react 6.1.2, vitest 4.1.12, @playwright/test 1.64.1, TypeScript 5.9 (tsc only for type checks). Every version is at least two weeks old (supply-chain rule); none has a real install script (genai's preinstall is an `echo`).

**Reuse decision:** Searched GitHub (kirana voice, khata udhaar, voice billing gemini, bahi khata). Best hits were 0-2 star hackathon repos with no licence (a Python app with a committed venv, a single index.html). Not adoptable; fresh scaffold.

---

## File map

| Path | Responsibility |
|---|---|
| `src/shared/intent.ts` | zod schemas + TS types for the API request/response (`Intent` discriminated union). Imported by client and server. |
| `src/domain/types.ts` | `Product`, `Customer`, `Txn` (sale / payment / stock_add), `Store`, `DraftLine`, `DraftBill`. |
| `src/domain/money.ts` | paise arithmetic, `formatINR`, `lineTotalPaise`. |
| `src/domain/units.ts` | `toProductUnits(qty, spokenUnit, productUnit)` (g to kg, ml to l, dozen to pc). |
| `src/domain/match.ts` | `normalise`, `matchProduct`, `matchCustomer` (Levenshtein + honorific stripping). |
| `src/domain/bill.ts` | `draftFromSale(intent, store)` -> `DraftBill`; `billTotal`; `validateDraft`. |
| `src/domain/store.ts` | pure reducers: `confirmSale`, `recordPayment`, `addStock`, `addCustomer`. |
| `src/domain/ledger.ts` | `balanceOf`, `allBalances`, `customerHistory`, `totalOutstanding`. |
| `src/domain/stock.ts` | `lowStock`, `isLow`. |
| `src/domain/queries.ts` | `answerQuery(query, store, now)` -> `{hi, en}` bilingual answer. |
| `src/domain/whatsapp.ts` | `formatBillText`, `whatsappUrl`. |
| `src/domain/seed.ts` + `seed-data.json` | 40 SKUs, 5 customers, past txns; `seedStore(now)`. JSON so `scripts/eval.ts` can import it under plain Node. |
| `server/prompt.ts` | system prompt, Gemini response schema, grounding text builder. |
| `server/gemini.ts` | `callGemini({audio?, text?, context}, {apiKey, model, timeoutMs})` using @google/genai. |
| `server/handler.ts` | `handleUnderstand(request: Request, deps)` : body cap, rate limit, validation, timeout, mapping raw model JSON to `Intent`. |
| `server/rateLimit.ts` | in-memory fixed-window limiter per IP. |
| `api/understand.ts` | Vercel entry: `export async function POST(req)` -> `handleUnderstand`. |
| `vite.config.ts` | React plugin + `localApi()` plugin mounting the handler on dev and preview servers. |
| `src/state/persist.ts` | load/save `Store` (idb-keyval, localStorage fallback). |
| `src/state/useStore.ts` | React hook: store + actions + persistence. |
| `src/ui/*` | App shell, MicButton, CommandBar, BillSheet, ConfirmCard, AnswerCard, KhataScreen, StockScreen, HomeScreen. |
| `src/lib/recorder.ts`, `src/lib/speak.ts`, `src/lib/api.ts` | MediaRecorder wrapper (30 s cap, base64), speechSynthesis hi-IN, fetch client. |
| `public/manifest.webmanifest`, `public/sw.js`, `public/icon.svg` | PWA shell, offline ledger viewing. |
| `tests/domain/*.test.ts` | vitest, one file per domain module. |
| `tests/api/handler.test.ts` | contract tests with Gemini mocked. |
| `e2e/smoke.spec.ts`, `e2e/demo.spec.ts` | Playwright smoke + recorded demo (mobile viewport). |
| `scripts/eval.ts`, `scripts/eval-cases.json` | 25 utterances, intent accuracy against `BASE_URL`. |
| `scripts/audio-test.sh` + `scripts/audio-test.ts` | `say -v Lekha` -> ffmpeg webm/opus -> POST audio path. |
| `scripts/publish.sh` | NOT executed: GitHub repo + Vercel deploy commands for Sakshi to approve. |

## Key interfaces (locked)

```ts
// src/shared/intent.ts
type PaymentMode = 'cash' | 'upi' | 'udhaar';
type IntentItem = { name: string; sku: string | null; qty: number; unit: string; amountRupees: number | null };
type Intent =
  | { kind: 'sale'; items: IntentItem[]; customer: string | null; paymentMode: PaymentMode }
  | { kind: 'payment'; customer: string; amount: number }
  | { kind: 'query'; query: 'sales_today' | 'customer_balance' | 'low_stock'; customer: string | null }
  | { kind: 'stock_add'; items: IntentItem[] }
  | { kind: 'unknown' };
type UnderstandResponse = { ok: true; intent: Intent; transcript: string; language: string } | { ok: false; error: string };
type UnderstandRequest = { text?: string; audio?: string; mimeType?: string;
  context: { products: { sku: string; name: string; nameHi?: string; unit: string }[]; customers: string[] } };
```

Gemini gets a flat schema (`intent`, `items[]`, `customer`, `paymentMode`, `amount`, `queryKind`, `transcript`, `language`) because response schemas handle flat objects more reliably than unions; `server/handler.ts` maps it to the union and zod-validates the result.

Money is integer paise everywhere in `src/domain`. Gemini never supplies a price; it may supply `amountRupees` only when the speaker said "10 rupaye ka dhaniya", in which case qty is derived from the catalogue price.

## Tasks

### Task 1: Scaffold
- [x] `package.json` (type module, scripts: dev, build, preview, test, test:e2e, eval, typecheck), `tsconfig.json`, `vite.config.ts`, `index.html`, `.gitignore`, `vercel.json`.
- [x] `npm install` pinned versions above. Run `npx vite build` on an empty App to prove the toolchain.
- [x] Commit `chore: scaffold`.

### Task 2: Domain (TDD, one module at a time)
For each of money, units, match, bill, store, ledger, stock, queries, whatsapp, seed:
- [x] Write failing tests in `tests/domain/<module>.test.ts` (examples: `lineTotalPaise(0.5, 4500) === 2250`; `toProductUnits(250,'g','kg') === 0.25`; `matchCustomer('sharma', customers)` returns Sharma ji; draft from a sale with an unknown item flags `needsPrice`; `confirmSale` decrements stock and an udhaar sale raises balance; `answerQuery({query:'sales_today'})` sums only today's sales; WhatsApp URL is `https://wa.me/?text=` + encodeURIComponent).
- [x] `npx vitest run tests/domain/<module>.test.ts` -> FAIL.
- [x] Implement minimal code; rerun -> PASS. Commit per module or pair.

### Task 3: API
- [x] `tests/api/handler.test.ts` with a fake `generate` dep: valid text sale maps to `Intent`; malformed model JSON -> 502 `ok:false`; body over 1 MB -> 413; 31st request in a minute from one IP -> 429; model slower than timeout -> 504; missing text and audio -> 400; non-POST -> 405; the API key never appears in any response body.
- [x] Implement `server/rateLimit.ts`, `server/prompt.ts`, `server/handler.ts`, `server/gemini.ts`, `api/understand.ts`. PASS.
- [x] Vite `localApi()` plugin: converts Node req to a Web `Request`, calls `handleUnderstand`, writes the `Response`.
- [x] Manual check: `curl -s localhost:5173/api/understand -d '{"text":"do kilo atta",...}'` returns a sale.

### Task 4: Live eval + prompt iteration
- [x] `scripts/eval-cases.json`: 25 cases (Hinglish, Hindi Devanagari, Marathi, English, mixes; sales incl. udhaar/upi, payments, three query kinds, stock adds, tricky ones like "Sharma ji ne 500 diye aur ek Maggi le gaye").
- [x] `node scripts/eval.ts` (BASE_URL default `http://localhost:5173`) prints per-case pass/fail and accuracy; also checks customer and key fields.
- [x] Iterate prompt until 90%+ or report honestly.

### Task 5: Audio path
- [x] `scripts/audio-test.sh`: `say -v Lekha` Devanagari sentence -> aiff -> `ffmpeg -c:a libopus` webm; `node scripts/audio-test.ts file.webm` posts base64 and prints intent.

### Task 6: UI (react-best-practices + frontend-design)
- [x] Persistence + `useStore` hook; seed on first load; reset demo.
- [x] Home: hold-to-talk mic (pointer events, 30 s cap), text fallback, today's summary, recent bills.
- [x] BillSheet (editable qty/price, amber unknown items, customer + payment mode chips, confirm, WhatsApp share), ConfirmCard for payment/stock_add, AnswerCard with speech.
- [x] Khata tab (balances, per-customer history, record payment), Stock tab (low-stock flags).
- [x] PWA manifest + service worker.

### Task 7: E2E, screenshots, demo video
- [x] `playwright.config.ts` (webServer `vite preview`, Pixel 7 viewport). `e2e/smoke.spec.ts`: load, type sale, confirm, ledger updated.
- [x] Screenshots to `docs/screenshots/`. `e2e/demo.spec.ts` with `video: on`, ~75 s scripted flow; ffmpeg to `submissions/demo/bolo-khata-demo.mp4`.

### Task 8: Docs and publish prep
- [x] README (what, {{APP_URL}}, screenshots, architecture, run, AI use, privacy, decisions, roadmap), `scripts/publish.sh` (not run), `task_plan.md` progress log.
- [x] Verification: `npm run typecheck && npm test && npm run test:e2e && node scripts/eval.ts`. Commit.
