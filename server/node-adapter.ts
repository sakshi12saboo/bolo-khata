import type { IncomingMessage, ServerResponse } from 'node:http';
import { Readable } from 'node:stream';

/** Node http request -> Web Request (body streamed, so the handler's byte cap applies). */
export function toWebRequest(req: IncomingMessage, trustProxy = false): Request {
  const headers = new Headers();
  for (const [k, v] of Object.entries(req.headers)) if (typeof v === 'string') headers.set(k, v);
  // Behind Cloud Run / Vercel the platform sets X-Forwarded-For. Locally, use the socket address.
  if (!trustProxy || !headers.has('x-forwarded-for')) headers.set('x-forwarded-for', req.socket.remoteAddress ?? 'unknown');
  const hasBody = req.method !== 'GET' && req.method !== 'HEAD';
  return new Request(`http://localhost${req.url ?? '/'}`, {
    method: req.method,
    headers,
    body: hasBody ? (Readable.toWeb(req) as ReadableStream) : undefined,
    // @ts-expect-error Node needs duplex for streamed request bodies
    duplex: 'half',
  });
}

export async function sendWebResponse(res: ServerResponse, response: Response): Promise<void> {
  res.statusCode = response.status;
  response.headers.forEach((v, k) => res.setHeader(k, v));
  res.end(Buffer.from(await response.arrayBuffer()));
}
