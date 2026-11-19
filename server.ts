/**
 * Custom Next.js server: serves the Next.js app and the Socket.IO server on the
 * same HTTP port. Used by `npm run dev` and `npm run start`.
 */
import { createServer } from 'node:http';
import { loadEnvConfig } from '@next/env';
import next from 'next';

const dev = process.env.NODE_ENV !== 'production';
loadEnvConfig(process.cwd(), dev);

const hostname = process.env.HOSTNAME_BIND ?? '0.0.0.0';
const port = Number(process.env.PORT) || 3000;

async function main() {
  const { createSocketServer } = await import('./src/server/socket');
  const app = next({ dev, hostname, port });
  const handle = app.getRequestHandler();
  await app.prepare();

  const httpServer = createServer((req, res) => {
    void handle(req, res);
  });

  const extraOrigins = process.env.CORS_ORIGIN?.split(',')
    .map((o) => o.trim())
    .filter(Boolean);
  const io = createSocketServer(httpServer, {
    corsOrigin: extraOrigins && extraOrigins.length > 0 ? extraOrigins : undefined,
  });

  httpServer.listen(port, () => {
    console.info(
      `[caro] Ready on http://localhost:${port} (${dev ? 'development' : 'production'})`,
    );
  });

  const shutdown = () => {
    io.close();
    httpServer.close(() => process.exit(0));
    setTimeout(() => process.exit(0), 5_000).unref();
  };
  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
