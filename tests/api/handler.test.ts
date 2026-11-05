import { describe, expect, it } from 'vitest';
import { handleUnderstand, type Deps } from '../../server/handler.js';
import { RateLimiter } from '../../server/rateLimit.js';
import { UnderstandOkSchema } from '../../src/shared/intent.js';

const context = { products: [{ sku: 'maggi', name: 'Maggi Noodles', unit: 'pkt' }], customers: ['Sharma ji'] };

const model = (raw: Record<string, unknown>) => JSON.stringify({
  intent: 'unknown', transcript: 't', language: 'hi', items: [], customer: null, paymentMode: null, amount: null, queryKind: null,
  ...raw,
});

function deps(generate: Deps['generate'], over: Partial<Deps> = {}): Deps {
  return { generate, limiter: new RateLimiter(30, 60_000), timeoutMs: 1000, maxBodyBytes: 1_000_000, ...over };
}

const post = (body: unknown, headers: Record<string, string> = {}) =>
  new Request('http://local/api/understand', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-forwarded-for': '1.2.3.4', ...headers },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  });

async function call(req: Request, d: Deps) {
  const res = await handleUnderstand(req, d);
  return { status: res.status, body: (await res.json()) as Record<string, unknown>, res };
}

describe('POST /api/understand', () => {
  it('returns a validated sale intent for a text command', async () => {
    const gen: Deps['generate'] = async () =>
      model({
        intent: 'sale', transcript: 'teen maggi sharma ji ke khate mein', language: 'hinglish',
        items: [{ name: 'Maggi', sku: 'maggi', qty: 3, unit: 'pkt', amountRupees: null }],
        customer: 'Sharma ji', paymentMode: 'udhaar',
      });
    const { status, body } = await call(post({ text: 'teen maggi sharma ji ke khate mein', context }), deps(gen));
    expect(status).toBe(200);
    expect(UnderstandOkSchema.parse(body)).toMatchObject({
      intent: { kind: 'sale', customer: 'Sharma ji', paymentMode: 'udhaar', items: [{ sku: 'maggi', qty: 3 }] },
      transcript: 'teen maggi sharma ji ke khate mein',
    });
  });

  it('passes audio and the grounding context to the model', async () => {
    let seen: unknown;
    const gen: Deps['generate'] = async (req) => { seen = req; return model({}); };
    await call(post({ audio: 'A'.repeat(64), mimeType: 'audio/webm;codecs=opus', context }), deps(gen));
    expect(seen).toMatchObject({ audio: 'A'.repeat(64), mimeType: 'audio/webm;codecs=opus', context });
  });

  it('defaults a sale with a named customer and no mode to udhaar', async () => {
    const gen: Deps['generate'] = async () => model({ intent: 'sale', items: [{ name: 'Maggi', sku: 'maggi', qty: 1, unit: 'pkt', amountRupees: null }], customer: 'Sharma ji' });
    const { body } = await call(post({ text: 'sharma ji ek maggi', context }), deps(gen));
    expect(body.intent).toMatchObject({ kind: 'sale', paymentMode: 'udhaar' });
  });

  it('defaults an anonymous sale to cash', async () => {
    const gen: Deps['generate'] = async () => model({ intent: 'sale', items: [{ name: 'Maggi', sku: 'maggi', qty: 1, unit: 'pkt', amountRupees: null }] });
    const { body } = await call(post({ text: 'ek maggi', context }), deps(gen));
    expect(body.intent).toMatchObject({ kind: 'sale', paymentMode: 'cash', customer: null });
  });

  it('maps payment, query and stock_add intents', async () => {
    const cases: [Record<string, unknown>, Record<string, unknown>][] = [
      [{ intent: 'payment', customer: 'Sharma ji', amount: 500 }, { kind: 'payment', customer: 'Sharma ji', amount: 500 }],
      [{ intent: 'query', queryKind: 'low_stock' }, { kind: 'query', query: 'low_stock', customer: null }],
      [{ intent: 'query', queryKind: 'customer_balance', customer: 'Sharma ji' }, { kind: 'query', query: 'customer_balance', customer: 'Sharma ji' }],
      [{ intent: 'stock_add', items: [{ name: 'Maggi', sku: 'maggi', qty: 24, unit: 'pkt', amountRupees: null }] }, { kind: 'stock_add' }],
    ];
    for (const [raw, expected] of cases) {
      const { body } = await call(post({ text: 'x', context }), deps(async () => model(raw)));
      expect(body.intent).toMatchObject(expected);
    }
  });

  it('downgrades an incomplete intent to unknown instead of guessing', async () => {
    const incomplete = [
      { intent: 'payment', customer: 'Sharma ji', amount: null },
      { intent: 'sale', items: [] },
      { intent: 'query', queryKind: null },
    ];
    for (const raw of incomplete) {
      const { status, body } = await call(post({ text: 'x', context }), deps(async () => model(raw)));
      expect(status).toBe(200);
      expect(body.intent).toEqual({ kind: 'unknown' });
    }
  });

  it('accepts JSON wrapped in a markdown fence', async () => {
    const gen: Deps['generate'] = async () => '```json\n' + model({ intent: 'query', queryKind: 'sales_today' }) + '\n```';
    const { body } = await call(post({ text: 'aaj kitna becha', context }), deps(gen));
    expect(body.intent).toMatchObject({ kind: 'query', query: 'sales_today' });
  });

  it('returns 502 when the model returns garbage', async () => {
    const { status, body } = await call(post({ text: 'x', context }), deps(async () => 'not json'));
    expect(status).toBe(502);
    expect(body.ok).toBe(false);
  });

  it('returns 504 when the model is slower than the timeout', async () => {
    const slow: Deps['generate'] = (_req, signal) =>
      new Promise((_, reject) => signal.addEventListener('abort', () => reject(new Error('aborted'))));
    const { status } = await call(post({ text: 'x', context }), deps(slow, { timeoutMs: 30 }));
    expect(status).toBe(504);
  });

  it('rejects bodies over the cap with 413', async () => {
    const big = JSON.stringify({ audio: 'A'.repeat(2000), mimeType: 'audio/webm', context });
    const { status } = await call(post(big), deps(async () => model({}), { maxBodyBytes: 1000 }));
    expect(status).toBe(413);
  });

  it('rejects a lying content-length header with 413 before reading', async () => {
    const { status } = await call(post({ text: 'x', context }, { 'content-length': '5000000' }), deps(async () => model({})));
    expect(status).toBe(413);
  });

  it('rate limits per IP with 429 and Retry-After', async () => {
    const d = deps(async () => model({}), { limiter: new RateLimiter(2, 60_000) });
    expect((await call(post({ text: 'x', context }), d)).status).toBe(200);
    expect((await call(post({ text: 'x', context }), d)).status).toBe(200);
    const third = await call(post({ text: 'x', context }), d);
    expect(third.status).toBe(429);
    expect(third.res.headers.get('retry-after')).toMatch(/^\d+$/);
    const otherIp = await call(post({ text: 'x', context }, { 'x-forwarded-for': '9.9.9.9' }), d);
    expect(otherIp.status).toBe(200);
  });

  it('rejects malformed requests with 400', async () => {
    const d = deps(async () => model({}));
    expect((await call(post('{oops'), d)).status).toBe(400);
    expect((await call(post({ context }), d)).status).toBe(400);
    expect((await call(post({ text: 'x', audio: 'A'.repeat(64), mimeType: 'audio/webm', context }), d)).status).toBe(400);
    expect((await call(post({ audio: 'A'.repeat(64), context }), d)).status).toBe(400);
    expect((await call(post({ text: 'x' }), d)).status).toBe(400);
  });

  it('rejects other methods with 405', async () => {
    const res = await handleUnderstand(new Request('http://local/api/understand'), deps(async () => model({})));
    expect(res.status).toBe(405);
  });

  it('never leaks upstream error text such as the API key', async () => {
    const gen: Deps['generate'] = async () => { throw new Error('400 API key AIzaSECRET is invalid'); };
    const { status, body } = await call(post({ text: 'x', context }), deps(gen));
    expect(status).toBe(502);
    expect(JSON.stringify(body)).not.toContain('AIza');
  });

  it('marks responses as uncacheable JSON', async () => {
    const { res } = await call(post({ text: 'x', context }), deps(async () => model({})));
    expect(res.headers.get('content-type')).toContain('application/json');
    expect(res.headers.get('cache-control')).toBe('no-store');
  });
});

describe('RateLimiter', () => {
  it('opens a new window after the old one expires', () => {
    let t = 0;
    const rl = new RateLimiter(1, 1000, () => t);
    expect(rl.hit('a').ok).toBe(true);
    expect(rl.hit('a').ok).toBe(false);
    t = 1001;
    expect(rl.hit('a').ok).toBe(true);
  });
});
