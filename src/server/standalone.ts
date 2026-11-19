/**
 * Standalone Socket.IO server (no Next.js). Use this to host the realtime layer
 * on a platform that supports long-lived connections (Render, Railway, Fly.io, VPS)
 * while the Next.js frontend runs on Vercel.
 */
import { createServer } from 'node:http';
import { loadEnvConfig } from '@next/env';

loadEnvConfig(process.cwd(), process.env.NODE_ENV !== 'production');

async function main() {
  const { createSocketServer } = await import('./socket');
  const port = Number(process.env.PORT) || 4000;
  const corsOrigin = (process.env.CORS_ORIGIN ?? 'http://localhost:3000')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);

  const httpServer = createServer((req, res) => {
    if (req.url === '/health') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ status: 'ok' }));
      return;
    }
    res.writeHead(404).end();
  });

  const io = createSocketServer(httpServer, { corsOrigin });

  httpServer.listen(port, () => {
    console.info(`[caro] Socket server listening on :${port} (CORS: ${corsOrigin.join(', ')})`);
  });

  const shutdown = () => {
    io.close(() => process.exit(0));
    setTimeout(() => process.exit(0), 5_000).unref();
  };
  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);
}

void main();
