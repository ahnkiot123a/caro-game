import { getPlayerToken } from '@/lib/identity';
import { getSocket } from '@/lib/socket';
import type { AckResult, CreateRoomResult } from '@/types/socket';

const ACK_TIMEOUT_MS = 8_000;

function ensureConnected(): Promise<void> {
  const socket = getSocket();
  if (socket.connected) return Promise.resolve();

  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      cleanup();
      reject(new Error('Unable to reach the game server.'));
    }, ACK_TIMEOUT_MS);
    const onConnect = () => {
      cleanup();
      resolve();
    };
    const cleanup = () => {
      clearTimeout(timer);
      socket.off('connect', onConnect);
    };
    socket.on('connect', onConnect);
    socket.connect();
  });
}

async function request<T>(send: () => Promise<AckResult<T>>): Promise<AckResult<T>> {
  try {
    await ensureConnected();
    return await send();
  } catch (error) {
    const message =
      error instanceof Error && error.message !== 'operation has timed out'
        ? error.message
        : 'The server did not respond. Check your connection.';
    return { ok: false, error: message };
  }
}

const timed = () => getSocket().timeout(ACK_TIMEOUT_MS);

export const socketService = {
  createRoom(name: string) {
    return request<CreateRoomResult>(() =>
      timed().emitWithAck('create-room', { name, token: getPlayerToken() }),
    );
  },
  joinRoom(roomId: string, name: string) {
    return request<{ roomId: string; playerId: string }>(() =>
      timed().emitWithAck('join-room', { roomId, name, token: getPlayerToken() }),
    );
  },
  move(roomId: string, row: number, col: number) {
    return request(() => timed().emitWithAck('move', { roomId, row, col }));
  },
  sendChat(roomId: string, content: string) {
    return request(() => timed().emitWithAck('chat-message', { roomId, content }));
  },
  playAgain(roomId: string) {
    return request(() => timed().emitWithAck('play-again', { roomId }));
  },
  leaveRoom(roomId: string) {
    return request(() => timed().emitWithAck('leave-room', { roomId }));
  },
};
