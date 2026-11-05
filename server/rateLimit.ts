/** Fixed-window, in-memory, per-key limiter. Good enough for one serverless instance; resets on cold start. */
export class RateLimiter {
  private hits = new Map<string, { start: number; count: number }>();

  constructor(
    private readonly limit: number,
    private readonly windowMs: number,
    private readonly now: () => number = Date.now,
  ) {}

  hit(key: string): { ok: boolean; retryAfterSec: number } {
    const t = this.now();
    if (this.hits.size > 5000) {
      for (const [k, v] of this.hits) if (t - v.start >= this.windowMs) this.hits.delete(k);
    }
    const cur = this.hits.get(key);
    if (!cur || t - cur.start >= this.windowMs) {
      this.hits.set(key, { start: t, count: 1 });
      return { ok: true, retryAfterSec: 0 };
    }
    cur.count += 1;
    const retryAfterSec = Math.max(1, Math.ceil((cur.start + this.windowMs - t) / 1000));
    return { ok: cur.count <= this.limit, retryAfterSec };
  }
}
