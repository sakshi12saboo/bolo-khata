import { Readable } from 'node:stream';
import type { IncomingMessage, ServerResponse } from 'node:http';
import react from '@vitejs/plugin-react';
import { defineConfig, type Connect, type Plugin } from 'vite';

/**
 * Serves POST /api/understand from the same handler Vercel runs, so `npm run dev`
 * and `npm run preview` work with no Vercel login. The key stays in this Node process.
 */
function localApi(): Plugin {
  const middleware: Connect.NextHandleFunction = async (req: IncomingMessage, res: ServerResponse, next) => {
    if (!req.url?.startsWith('/api/understand')) return next();
    try {
      const { understand } = await import('./server/instance.js');
      const headers = new Headers();
      for (const [k, v] of Object.entries(req.headers)) if (typeof v === 'string') headers.set(k, v);
      if (!headers.has('x-forwarded-for') && req.socket.remoteAddress) headers.set('x-forwarded-for', req.socket.remoteAddress);
      const hasBody = req.method !== 'GET' && req.method !== 'HEAD';
      const request = new Request(`http://localhost${req.url}`, {
        method: req.method,
        headers,
        body: hasBody ? (Readable.toWeb(req) as ReadableStream) : undefined,
        // @ts-expect-error Node needs duplex for streamed request bodies
        duplex: 'half',
      });
      const response = await understand(request);
      res.statusCode = response.status;
      response.headers.forEach((v, k) => res.setHeader(k, v));
      res.end(await response.text());
    } catch (e) {
      console.error('[local api]', e);
      res.statusCode = 500;
      res.setHeader('content-type', 'application/json');
      res.end(JSON.stringify({ ok: false, error: 'local api crashed' }));
    }
  };
  return {
    name: 'bolo-khata-local-api',
    configureServer: (server) => void server.middlewares.use(middleware),
    configurePreviewServer: (server) => void server.middlewares.use(middleware),
  };
}

export default defineConfig({
  plugins: [react(), localApi()],
  server: { port: 5173, strictPort: true },
  preview: { port: 4173, strictPort: true },
});
