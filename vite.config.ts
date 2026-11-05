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
      const [{ understand }, { toWebRequest, sendWebResponse }] = await Promise.all([
        import('./server/instance.js'),
        import('./server/node-adapter.js'),
      ]);
      await sendWebResponse(res, await understand(toWebRequest(req)));
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
