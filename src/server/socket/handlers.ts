import type { Server, Socket } from 'socket.io';
import type { ZodType, ZodTypeDef } from 'zod';
import { RECONNECT_GRACE_MS } from '@/lib/constants';
import type {
  Ack,
  ClientToServerEvents,
  InterServerEvents,
  ServerToClientEvents,
  SocketData,
} from '@/types/socket';
import { GameError } from '../game/gameLogic';
import { toPublicPlayer, toPublicRoom, type RoomService } from '../game/roomService';
import type { RoomRecord } from '../game/types';
import { cancelDisconnectTimeout, scheduleDisconnectTimeout } from './disconnectTimers';
import { RateLimiter } from './rateLimiter';
import {
  chatSchema,
  createRoomSchema,
  joinRoomSchema,
  moveSchema,
  roomScopedSchema,
} from './schemas';

export type CaroServer = Server<
  ClientToServerEvents,
  ServerToClientEvents,
  InterServerEvents,
  SocketData
>;
export type CaroSocket = Socket<
  ClientToServerEvents,
  ServerToClientEvents,
  InterServerEvents,
  SocketData
>;

const chatLimiter = new RateLimiter(5, 3_000);
const actionLimiter = new RateLimiter(30, 5_000);

function parse<T>(schema: ZodType<T, ZodTypeDef, unknown>, payload: unknown): T {
  const result = schema.safeParse(payload);
  if (!result.success) throw new GameError(result.error.issues[0]?.message ?? 'Invalid payload.');
  return result.data;
}

/** Runs a handler, converting thrown errors into a failed ack instead of crashing the socket. */
async function handle<T>(ack: Ack<T> | undefined, fn: () => Promise<T | undefined>): Promise<void> {
  const reply = typeof ack === 'function' ? ack : () => undefined;
  try {
    const data = await fn();
    reply({ ok: true, data });
  } catch (error) {
    if (error instanceof GameError) {
      reply({ ok: false, error: error.message });
    } else {
      console.error('[caro] socket handler error', error);
      reply({ ok: false, error: 'Unexpected server error. Please try again.' });
    }
  }
}

export function registerSocketHandlers(io: CaroServer, service: RoomService): void {
  const broadcastRoom = (room: RoomRecord) =>
    io.to(room.id).emit('room-updated', toPublicRoom(room));

  const systemMessage = async (roomId: string, content: string) => {
    const message = await service.addSystemMessage(roomId, content);
    io.to(roomId).emit('chat-message', message);
  };

  const onPlayerExpired = async (roomId: string, playerId: string) => {
    try {
      const result = await service.expireDisconnected(roomId, playerId);
      if (!result) return;
      io.to(roomId).emit('player-left', {
        playerId,
        playerName: result.player.name,
        reason: 'timeout',
      });
      if (result.room) {
        broadcastRoom(result.room);
        await systemMessage(
          roomId,
          `${result.player.name} did not reconnect in time and left the room.`,
        );
      }
    } catch (error) {
      console.error('[caro] failed to expire disconnected player', error);
    }
  };

  /** Detach the socket from whatever room it is currently in (explicit leave). */
  const leaveCurrentRoom = async (socket: CaroSocket) => {
    const { roomId, playerId } = socket.data;
    if (!roomId || !playerId) return;

    socket.data.roomId = null;
    socket.data.playerId = null;
    await socket.leave(roomId);
    cancelDisconnectTimeout(roomId, playerId);

    const result = await service.leaveRoom(roomId, playerId);
    if (!result) return;
    io.to(roomId).emit('player-left', { playerId, playerName: result.player.name, reason: 'left' });
    if (result.room) {
      broadcastRoom(result.room);
      await systemMessage(roomId, `${result.player.name} left the room.`);
    }
  };

  io.on('connection', (socket: CaroSocket) => {
    socket.data.roomId = null;
    socket.data.playerId = null;

    const guard = () => {
      if (!actionLimiter.allow(socket.id)) throw new GameError('Too many requests. Slow down.');
    };

    const requireMembership = (roomId: string): string => {
      if (socket.data.roomId !== roomId || !socket.data.playerId) {
        throw new GameError('You are not in this room.');
      }
      return socket.data.playerId;
    };

    socket.on('create-room', (payload, ack) =>
      handle(ack, async () => {
        guard();
        const { name, token } = parse(createRoomSchema, payload);
        await leaveCurrentRoom(socket);

        const { room, message } = await service.createRoom(name, token, socket.id);
        const [host] = room.players;
        socket.data.roomId = room.id;
        socket.data.playerId = host.id;
        await socket.join(room.id);

        socket.emit('room-created', toPublicRoom(room));
        socket.emit('chat-message', message);
        return {
          roomId: room.id,
          room: toPublicRoom(room),
          playerId: host.id,
          chat: [message],
        };
      }),
    );

    socket.on('join-room', (payload, ack) =>
      handle(ack, async () => {
        guard();
        const { roomId, name, token } = parse(joinRoomSchema, payload);

        if (socket.data.roomId && socket.data.roomId !== roomId) {
          await leaveCurrentRoom(socket);
        }

        const result = await service.joinRoom(roomId, name, token, socket.id);
        const { room, player } = result;
        cancelDisconnectTimeout(roomId, player.id);

        if (result.replacedSocketId) {
          // The same player opened the room from another connection; detach the old one.
          io.to(result.replacedSocketId).emit('room-error', {
            message: 'This seat was opened in another tab or device.',
          });
          io.in(result.replacedSocketId).socketsLeave(roomId);
        }

        socket.data.roomId = roomId;
        socket.data.playerId = player.id;
        await socket.join(roomId);

        const chat = await service.getChat(roomId);
        socket.emit('room-joined', {
          room: toPublicRoom(room),
          playerId: player.id,
          chat,
          reconnected: result.reconnected,
        });

        if (result.announce) {
          socket.to(roomId).emit('player-joined', {
            player: toPublicPlayer(player),
            reconnected: result.reconnected,
          });
          await systemMessage(
            roomId,
            result.reconnected ? `${player.name} reconnected.` : `${player.name} joined the room.`,
          );
        }
        broadcastRoom(room);
        return { roomId, playerId: player.id };
      }),
    );

    socket.on('move', (payload, ack) =>
      handle(ack, async () => {
        guard();
        const { roomId, row, col } = parse(moveSchema, payload);
        const playerId = requireMembership(roomId);

        const { room, move, outcome, player } = await service.makeMove(roomId, playerId, row, col);

        io.to(roomId).emit('move-made', { move, nextTurn: room.game.currentTurn });
        if (outcome === 'win' && room.game.winningLine) {
          io.to(roomId).emit('game-won', {
            winnerId: player.id,
            winnerName: player.name,
            symbol: player.symbol,
            line: room.game.winningLine,
          });
          await systemMessage(roomId, `${player.name} (${player.symbol}) won the match!`);
        } else if (outcome === 'draw') {
          io.to(roomId).emit('draw');
          await systemMessage(roomId, 'The match ended in a draw.');
        }
        broadcastRoom(room);
        return undefined;
      }),
    );

    socket.on('chat-message', (payload, ack) =>
      handle(ack, async () => {
        const { roomId, content } = parse(chatSchema, payload);
        const playerId = requireMembership(roomId);
        if (!chatLimiter.allow(socket.id))
          throw new GameError('You are sending messages too fast.');

        const message = await service.addChatMessage(roomId, playerId, content);
        io.to(roomId).emit('chat-message', message);
        return undefined;
      }),
    );

    socket.on('play-again', (payload, ack) =>
      handle(ack, async () => {
        guard();
        const { roomId } = parse(roomScopedSchema, payload);
        const playerId = requireMembership(roomId);

        const { room, player, restarted } = await service.requestPlayAgain(roomId, playerId);
        if (restarted) {
          await systemMessage(roomId, `Round ${room.game.round} started. Sides have been swapped.`);
        } else {
          io.to(roomId).emit('play-again-request', {
            playerId,
            playerName: player.name,
            votes: room.game.playAgainVotes,
          });
        }
        broadcastRoom(room);
        return undefined;
      }),
    );

    socket.on('leave-room', (payload, ack) =>
      handle(ack, async () => {
        const { roomId } = parse(roomScopedSchema, payload);
        if (socket.data.roomId === roomId) await leaveCurrentRoom(socket);
        return undefined;
      }),
    );

    socket.on('disconnect', async () => {
      chatLimiter.reset(socket.id);
      actionLimiter.reset(socket.id);

      const { roomId, playerId } = socket.data;
      if (!roomId || !playerId) return;

      try {
        const result = await service.markDisconnected(roomId, playerId, socket.id);
        if (!result) return;

        io.to(roomId).emit('player-left', {
          playerId,
          playerName: result.player.name,
          reason: 'disconnected',
        });
        broadcastRoom(result.room);
        await systemMessage(
          roomId,
          `${result.player.name} disconnected. Waiting ${RECONNECT_GRACE_MS / 1000}s for them to return.`,
        );
        scheduleDisconnectTimeout(roomId, playerId, RECONNECT_GRACE_MS, () => {
          void onPlayerExpired(roomId, playerId);
        });
      } catch (error) {
        console.error('[caro] failed to handle disconnect', error);
      }
    });
  });
}
