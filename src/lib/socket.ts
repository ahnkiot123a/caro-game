import { io, type Socket } from 'socket.io-client';
import type { ClientToServerEvents, ServerToClientEvents } from '@/types/socket';

export type CaroClientSocket = Socket<ServerToClientEvents, ClientToServerEvents>;

let socket: CaroClientSocket | null = null;

/** Browser-side Socket.IO singleton shared across pages (survives client-side navigation). */
export function getSocket(): CaroClientSocket {
  if (typeof window === 'undefined') {
    throw new Error('getSocket() must only be called in the browser.');
  }
  if (!socket) {
    const url = process.env.NEXT_PUBLIC_SOCKET_URL || undefined;
    socket = io(url, {
      path: '/socket.io',
      autoConnect: false,
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionDelay: 500,
      reconnectionDelayMax: 4_000,
      withCredentials: Boolean(url),
    });
  }
  return socket;
}
