import { makeGeminiGenerate } from './gemini.js';
import { handleUnderstand, type Deps } from './handler.js';
import { RateLimiter } from './rateLimit.js';

/** One limiter per warm instance, shared by every request it serves. */
const limiter = new RateLimiter(Number(process.env.RATE_LIMIT_PER_MIN) || 10, 60_000);

export function productionDeps(): Deps {
  return {
    generate: makeGeminiGenerate({ apiKey: process.env.GEMINI_API_KEY, model: process.env.GEMINI_MODEL, thinking: process.env.GEMINI_THINKING }),
    limiter,
    timeoutMs: 8000,
    maxBodyBytes: 400_000,
    log: (m) => console.error(`[understand] ${m}`),
  };
}

export const understand = (req: Request) => handleUnderstand(req, productionDeps());
