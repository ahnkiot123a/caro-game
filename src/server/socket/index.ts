import type { Server as HttpServer } from 'node:http';
import { Server } from 'socket.io';
import { RoomService } from '../game/roomService';
import { registerSocketHandlers, type CaroServer } from './handlers';

export interface SocketServerOptions {
  /** Allowed browser origins. Undefined = same-origin only. */
  corsOrigin?: string[];
}

export function createSocketServer(
  httpServer: HttpServer,
  options: SocketServerOptions = {},
): CaroServer {
  const io: CaroServer = new Server(httpServer, {
    path: '/socket.io',
    cors: options.corsOrigin ? { origin: options.corsOrigin, credentials: true } : undefined,
    pingInterval: 10_000,
    pingTimeout: 8_000,
    maxHttpBufferSize: 16 * 1024,
  });

  registerSocketHandlers(io, new RoomService());
  return io;
}
