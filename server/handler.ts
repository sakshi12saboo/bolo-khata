import { z } from 'zod';
import {
  IntentSchema,
  UnderstandRequestSchema,
  type Intent,
  type UnderstandContext,
  type UnderstandResponse,
} from '../src/shared/intent.js';
import type { RateLimiter } from './rateLimit.js';

export interface ModelRequest {
  text?: string;
  audio?: string;
  mimeType?: string;
  context: UnderstandContext;
}

export interface Deps {
  /** Calls the model and returns its raw text output (expected to be JSON). */
  generate: (req: ModelRequest, signal: AbortSignal) => Promise<string>;
  limiter: RateLimiter;
  timeoutMs?: number;
  maxBodyBytes?: number;
  log?: (msg: string) => void;
}

const RawItem = z.object({
  name: z.string().trim().min(1).catch(''),
  sku: z.string().nullable().catch(null),
  qty: z.number().nullable().catch(null),
  unit: z.string().nullable().catch(null),
  amountRupees: z.number().nullable().catch(null),
});

/** What the model returns: one flat object. Lenient, then mapped to the strict Intent union. */
const RawModelSchema = z.object({
  intent: z.enum(['sale', 'payment', 'query', 'stock_add', 'unknown']).catch('unknown'),
  transcript: z.string().catch(''),
  language: z.string().catch('unknown'),
  items: z.array(RawItem).nullable().catch([]),
  customer: z.string().nullable().catch(null),
  paymentMode: z.enum(['cash', 'upi', 'udhaar']).nullable().catch(null),
  amount: z.number().nullable().catch(null),
  queryKind: z.enum(['sales_today', 'customer_balance', 'low_stock']).nullable().catch(null),
});
type Raw = z.infer<typeof RawModelSchema>;

class HttpError extends Error {
  constructor(readonly status: number, message: string, readonly headers: Record<string, string> = {}) {
    super(message);
  }
}

function json(status: number, body: UnderstandResponse, headers: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', ...headers },
  });
}

function clientIp(req: Request): string {
  const fwd = req.headers.get('x-forwarded-for');
  if (fwd) return fwd.split(',')[0]!.trim();
  return req.headers.get('x-real-ip') ?? 'unknown';
}

async function readCapped(req: Request, max: number): Promise<string> {
  const declared = Number(req.headers.get('content-length') ?? '0');
  if (declared > max) throw new HttpError(413, 'Request too large');
  if (!req.body) return '';
  const reader = req.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > max) {
      await reader.cancel();
      throw new HttpError(413, 'Request too large');
    }
    chunks.push(value);
  }
  return new TextDecoder().decode(Buffer.concat(chunks));
}

function parseModelJson(text: string): Raw {
  const cleaned = text.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');
  let parsed: unknown;
  try {
    parsed = JSON.parse(cleaned);
  } catch {
    throw new HttpError(502, 'AI reply was not readable');
  }
  const raw = RawModelSchema.safeParse(parsed);
  if (!raw.success) throw new HttpError(502, 'AI reply was not readable');
  return raw.data;
}

function cleanItems(items: Raw['items']) {
  return (items ?? [])
    .filter((i) => i.name)
    .map((i) => ({
      name: i.name.slice(0, 80),
      sku: i.sku || null,
      qty: i.qty && i.qty > 0 ? i.qty : 1,
      unit: (i.unit ?? '').slice(0, 12),
      amountRupees: i.amountRupees && i.amountRupees > 0 ? i.amountRupees : null,
    }));
}

export function toIntent(raw: Raw): Intent {
  const customer = raw.customer?.trim() || null;
  let intent: Intent = { kind: 'unknown' };
  switch (raw.intent) {
    case 'sale': {
      const items = cleanItems(raw.items);
      if (items.length) intent = { kind: 'sale', items, customer, paymentMode: raw.paymentMode ?? (customer ? 'udhaar' : 'cash') };
      break;
    }
    case 'payment':
      if (customer && raw.amount && raw.amount > 0) intent = { kind: 'payment', customer, amount: raw.amount };
      break;
    case 'query':
      if (raw.queryKind) intent = { kind: 'query', query: raw.queryKind, customer: raw.queryKind === 'customer_balance' ? customer : null };
      break;
    case 'stock_add': {
      const items = cleanItems(raw.items);
      if (items.length) intent = { kind: 'stock_add', items };
      break;
    }
  }
  const checked = IntentSchema.safeParse(intent);
  return checked.success ? checked.data : { kind: 'unknown' };
}

export async function handleUnderstand(req: Request, deps: Deps): Promise<Response> {
  const log = deps.log ?? (() => {});
  try {
    if (req.method !== 'POST') throw new HttpError(405, 'Use POST', { allow: 'POST' });

    const gate = deps.limiter.hit(clientIp(req));
    if (!gate.ok) throw new HttpError(429, 'Too many requests, thoda ruk kar try kariye', { 'retry-after': String(gate.retryAfterSec) });

    const text = await readCapped(req, deps.maxBodyBytes ?? 1_000_000);
    let body: unknown;
    try {
      body = JSON.parse(text);
    } catch {
      throw new HttpError(400, 'Body must be JSON');
    }
    const parsed = UnderstandRequestSchema.safeParse(body);
    if (!parsed.success) throw new HttpError(400, parsed.error.issues[0]?.message ?? 'Invalid request');

    const controller = new AbortController();
    const timeoutMs = deps.timeoutMs ?? 8000;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const timeout = new Promise<never>((_, reject) => {
      timer = setTimeout(() => {
        reject(new HttpError(504, 'AI took too long'));
        controller.abort();
      }, timeoutMs);
    });

    let output: string;
    try {
      output = await Promise.race([deps.generate(parsed.data, controller.signal), timeout]);
    } catch (e) {
      if (e instanceof HttpError) throw e;
      log(`model error: ${e instanceof Error ? e.message : String(e)}`);
      throw new HttpError(502, 'AI service unavailable');
    } finally {
      clearTimeout(timer);
    }

    const raw = parseModelJson(output);
    const transcript = raw.transcript || parsed.data.text || '';
    return json(200, { ok: true, intent: toIntent(raw), transcript: transcript.slice(0, 500), language: raw.language.slice(0, 20) });
  } catch (e) {
    if (e instanceof HttpError) return json(e.status, { ok: false, error: e.message }, e.headers);
    log(`unexpected: ${e instanceof Error ? e.message : String(e)}`);
    return json(500, { ok: false, error: 'Something went wrong' });
  }
}
