/**
 * Standalone server for Google Cloud Run (or any container host): serves the built PWA from dist/
 * and POST /api/understand through the same handler the Vercel function uses.
 * Build: npm run build:server   Run: PORT=8080 node dist-server/node-server.js
 */
import { readFile, stat } from 'node:fs/promises';
import { createServer } from 'node:http';
import { extname, join, normalize, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { sendWebResponse, toWebRequest } from './node-adapter.js';
import { understand } from './instance.js';

const ROOT = resolve(fileURLToPath(new URL('.', import.meta.url)), process.env.STATIC_DIR ?? '../dist');
const PORT = Number(process.env.PORT ?? 8080);
const TYPES: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.webmanifest': 'application/manifest+json',
  '.json': 'application/json',
};

async function serveStatic(pathname: string): Promise<{ body: Buffer; type: string; immutable: boolean } | null> {
  const safe = normalize(decodeURIComponent(pathname)).replace(/^(\.\.[/\\])+/, '');
  const file = join(ROOT, safe);
  if (!file.startsWith(ROOT)) return null;
  try {
    const s = await stat(file);
    if (!s.isFile()) return null;
    return { body: await readFile(file), type: TYPES[extname(file)] ?? 'application/octet-stream', immutable: safe.startsWith('/assets/') };
  } catch {
    return null;
  }
}

const server = createServer(async (req, res) => {
  try {
    const url = new URL(req.url ?? '/', 'http://localhost');
    if (url.pathname === '/healthz') return void res.end('ok');
    if (url.pathname === '/api/understand') return void (await sendWebResponse(res, await understand(toWebRequest(req, true))));
    if (req.method !== 'GET' && req.method !== 'HEAD') {
      res.statusCode = 405;
      return void res.end();
    }
    const hit = (url.pathname !== '/' && (await serveStatic(url.pathname))) || (await serveStatic('/index.html'));
    if (!hit) {
      res.statusCode = 404;
      return void res.end('not found');
    }
    res.setHeader('content-type', hit.type);
    res.setHeader('cache-control', hit.immutable ? 'public, max-age=31536000, immutable' : 'no-cache');
    res.setHeader('x-content-type-options', 'nosniff');
    res.end(req.method === 'HEAD' ? undefined : hit.body);
  } catch (e) {
    console.error('[server]', e);
    res.statusCode = 500;
    res.end('server error');
  }
});

server.listen(PORT, () => console.log(`Bolo Khata listening on :${PORT} (static from ${ROOT})`));
