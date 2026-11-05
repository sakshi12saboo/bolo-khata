# Bolo Khata: design spec

Date: 5 Nov 2026
Owner: Sakshi Saboo (sakshi12saboo@gmail.com)
Status: decided (Sakshi delegated every decision, no review gate before build; one review at the end)

## 1. Why this exists

Two open competitions in Sakshi's inbox, one product entered in both:

| Competition | Fit | Key dates |
|---|---|---|
| Scaler x Wispr Flow voice-first AI hackathon (hackos.scaler.com/wispr) | Track "Small business"; brief literally names "Shops & Kirana stores: order list and billing for customer voice orders" | Round 1 online warm-up: Idea opens 5 Nov, Prompt 13 Nov, Impact 20 Nov, closes 26 Nov. Registration closes 27 Nov. Round 2 shared problem 27-29 Nov. Finale 13 Dec |
| Google DeepMind x Google Cloud Startup Buildathon India 2026 (hack2skill) | AI product built on Gemini; early-stage idea welcome | Application (idea + solution architecture + pitch deck) closes 13 Nov. City buildathon 20-21 Nov (Pune). Finale 2 Dec |

Chosen over an ESG/BRSR voice tool because that overlaps Sakshi's employer (Credibl) and creates IP questions. Kirana is neutral, named in the Scaler brief, and a large, legible Indian market.

## 2. The product in one line

A kirana owner speaks a sale the way they already talk ("do kilo atta, ek Amul doodh, Sharma ji ke khate mein likh do") and gets an itemised bill, a stock update, and an udhaar ledger entry, with the bill shareable on WhatsApp. No typing.

## 3. Users and the problem

- 13M+ kirana stores; most still run billing and credit (udhaar) in a paper bahi-khata.
- Owners serve a queue with both hands busy; typing on a POS or a phone keyboard is slow, and English-first apps exclude many.
- Udhaar is the real pain: forgotten entries and disputes cost money and relationships.

## 4. Scope (v1, the demo)

In:
1. **Voice sale**: hold-to-talk mic. Audio goes to Gemini (multimodal, native audio understanding) which returns structured JSON: line items (name, qty, unit, unit price, line total), customer name if mentioned, payment mode (cash / UPI / udhaar). Works in Hindi, Hinglish, Marathi, English and mixes thereof.
2. **Bill screen**: editable items before confirm, total, "Share on WhatsApp" (wa.me deep link with a formatted text bill).
3. **Udhaar ledger**: per-customer balance; voice commands like "Sharma ji ne 500 jama kiye" record a payment.
4. **Stock**: catalogue with price and stock; confirmed sales decrement stock; low-stock flag.
5. **Voice questions**: "aaj kitna becha?", "Sharma ji ka kitna baaki hai?", "kya khatam ho raha hai?" answered on screen and spoken back (browser speechSynthesis, hi-IN).
6. **Seeded demo store** (about 40 common kirana SKUs with realistic MRP) so the demo works on first load.
7. **Fallback input**: text box for typed commands (also used by automated tests and when mic permission is denied).

Out (v1): accounts/login, multi-device sync, payments integration, GST invoices, supplier ordering. Mentioned in the pitch as roadmap only.

## 5. Architecture

- **Frontend**: Vite + React + TypeScript, mobile-first PWA (installable, works offline for ledger viewing). State persisted in IndexedDB (via a tiny wrapper) with localStorage fallback. All data stays on the device: a privacy point for the pitch.
- **AI endpoint**: one Vercel serverless function `POST /api/understand` that takes either `{audio: base64, mimeType}` or `{text}` plus the current catalogue and customer names (for grounding / fuzzy matching), calls Gemini with a JSON response schema, and returns a typed intent:
  - `sale` {items[], customer?, paymentMode}
  - `payment` {customer, amount}
  - `query` {kind: sales_today | customer_balance | low_stock, customer?}
  - `stock_add` {items[]}
  - `unknown` {transcript}
  Every response also carries `transcript` and `language`.
- **Model**: `gemini-2.5-flash` (stable, native audio, structured output, low latency). Model id in one env var `GEMINI_MODEL` so it can be swapped to `gemini-3-flash-preview`.
- **Key handling**: `GEMINI_API_KEY` only in Vercel env, never shipped to the browser. Basic abuse guard: 30-second audio cap, 1 MB body cap, simple per-IP rate limit in memory.
- **Business logic is pure and client-side** (`src/domain/`): applying a sale, ledger balances, daily totals, low-stock, query answers. Gemini only parses intent; it never computes money. Totals are computed in code from catalogue prices, so a mis-hearing can never invent a price silently; unknown items are flagged for the owner to price.

## 6. Error handling

- Mic denied / unsupported: fall back to the text box, with a one-line notice.
- Gemini error or timeout (8 s): show "samajh nahi aaya, phir se boliye" and keep the audio retry button.
- Item not in catalogue: shown in amber with a price field; never silently dropped.
- Ambiguous customer ("Sharma" when two exist): pick the closest match and show it editable.

## 7. Testing

- Vitest unit tests for every `src/domain` function (money maths, ledger, stock).
- Contract tests for `/api/understand` response validation (zod schema), with Gemini mocked.
- A live eval script (`scripts/eval.ts`) that runs 25 real Hinglish/Hindi/Marathi text utterances against the deployed endpoint and reports intent accuracy; target 90%+.
- Playwright smoke test on the deployed URL: load, type a sale command, confirm bill, check ledger.

## 8. Deliverables

1. Deployed app on Vercel (Sakshi's account `sakshi12saboo-2586`).
2. Public GitHub repo under `sakshi12saboo` with a clear README.
3. `submissions/scaler/`: Round 1 Idea, Prompt and Impact drafts (text ready to paste), plus registration checklist.
4. `submissions/buildathon/`: application answers, solution architecture doc + diagram (PNG/SVG), pitch deck (.pptx, 10 slides), demo video script, and a recorded screen demo (Playwright video + ffmpeg) if feasible.
5. `submissions/CHECKLIST.md`: the short list of things only Sakshi can do (register, log in, click submit, attend in person), with links and deadlines.

## 9. Constraints and rules for the build

- GitHub: push only as `sakshi12saboo` (use `GH_TOKEN=$(gh auth token --user sakshi12saboo)`); the active gh account on this Mac is someone else's (`abhay-yemekar`), never push there and never switch the active account.
- No em dashes in user-facing copy. Plain, human tone.
- Reuse before build: check GitHub for a good existing voice-billing / khata starter before scaffolding; audit any dependency before installing.
- Nothing is submitted to any competition portal by Claude; Sakshi submits.
