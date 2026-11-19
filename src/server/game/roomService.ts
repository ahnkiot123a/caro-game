import { createHash } from 'node:crypto';
import { MAX_PLAYERS, RECONNECT_GRACE_MS } from '@/lib/constants';
import type { ChatMessage, Move, Player, PlayerSymbol, Room } from '@/types/game';
import {
  GameError,
  applyMove,
  createGameState,
  oppositeSymbol,
  startGame,
  type MoveOutcome,
} from './gameLogic';
import { generateId, generateRoomId } from './ids';
import { withLock } from './lock';
import { getRoomRepository } from './repository';
import type { PlayerRecord, RoomRecord, RoomRepository } from './types';

export function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

export function toPublicPlayer({ tokenHash: _t, socketId: _s, ...player }: PlayerRecord): Player {
  return player;
}

export function toPublicRoom(room: RoomRecord): Room {
  return {
    id: room.id,
    hostId: room.hostId,
    createdAt: room.createdAt,
    updatedAt: room.updatedAt,
    game: room.game,
    players: room.players.map(toPublicPlayer),
  };
}

export interface JoinResult {
  room: RoomRecord;
  player: PlayerRecord;
  /** True when the player already had a seat (page refresh / network reconnect). */
  reconnected: boolean;
  /** True when other room members should be told about this join. */
  announce: boolean;
  /** Previous socket that held this seat and must be detached. */
  replacedSocketId: string | null;
}

export interface MoveResult {
  room: RoomRecord;
  move: Move;
  outcome: MoveOutcome;
  player: PlayerRecord;
}

export interface LeaveResult {
  /** Null when the room was deleted because it became empty. */
  room: RoomRecord | null;
  player: PlayerRecord;
}

export class RoomService {
  constructor(private readonly repo: RoomRepository = getRoomRepository()) {}

  private async load(roomId: string): Promise<RoomRecord> {
    const room = await this.repo.get(roomId);
    if (!room) throw new GameError('Room not found or has expired.');
    return room;
  }

  private async persist(room: RoomRecord): Promise<RoomRecord | null> {
    if (room.players.length === 0) {
      await this.repo.delete(room.id);
      return null;
    }
    room.updatedAt = Date.now();
    await this.repo.save(room);
    return room;
  }

  /** Removes a player and resets the board so the remaining player can wait for a new opponent. */
  private removePlayer(room: RoomRecord, playerId: string): void {
    room.players = room.players.filter((p) => p.id !== playerId);
    const [remaining] = room.players;
    if (remaining) {
      remaining.symbol = 'X';
      remaining.isHost = true;
      room.hostId = remaining.id;
    }
    room.game = createGameState(room.game.round + 1);
  }

  /** Drops players whose reconnect grace period elapsed (covers server restarts / other instances). */
  private pruneExpired(room: RoomRecord, now = Date.now()): PlayerRecord[] {
    const expired = room.players.filter(
      (p) =>
        !p.connected && p.disconnectedAt !== null && now - p.disconnectedAt >= RECONNECT_GRACE_MS,
    );
    for (const player of expired) this.removePlayer(room, player.id);
    return expired;
  }

  private createPlayer(
    name: string,
    token: string,
    socketId: string,
    symbol: PlayerSymbol,
    isHost: boolean,
  ): PlayerRecord {
    return {
      id: generateId(),
      name,
      symbol,
      isHost,
      connected: true,
      disconnectedAt: null,
      joinedAt: Date.now(),
      wins: 0,
      tokenHash: hashToken(token),
      socketId,
    };
  }

  async createRoom(
    name: string,
    token: string,
    socketId: string,
  ): Promise<{ room: RoomRecord; message: ChatMessage }> {
    let roomId = generateRoomId();
    for (let attempt = 0; (await this.repo.exists(roomId)) && attempt < 5; attempt++) {
      roomId = generateRoomId();
    }

    const host = this.createPlayer(name, token, socketId, 'X', true);
    const now = Date.now();
    const room: RoomRecord = {
      id: roomId,
      hostId: host.id,
      createdAt: now,
      updatedAt: now,
      players: [host],
      game: createGameState(),
    };
    const message: ChatMessage = {
      id: generateId(),
      roomId,
      type: 'system',
      playerId: null,
      playerName: 'System',
      content: `${host.name} created the room.`,
      createdAt: now,
    };
    await this.repo.save(room, message);
    return { room, message };
  }

  async joinRoom(
    roomId: string,
    name: string,
    token: string,
    socketId: string,
  ): Promise<JoinResult> {
    return withLock(roomId, async () => {
      const room = await this.load(roomId);
      this.pruneExpired(room);

      const tokenHash = hashToken(token);
      const existing = room.players.find((p) => p.tokenHash === tokenHash);

      if (existing) {
        const wasDisconnected = !existing.connected;
        const replacedSocketId =
          existing.socketId && existing.socketId !== socketId && existing.connected
            ? existing.socketId
            : null;
        existing.connected = true;
        existing.disconnectedAt = null;
        existing.socketId = socketId;
        existing.name = name || existing.name;
        await this.persist(room);
        return {
          room,
          player: existing,
          reconnected: true,
          announce: wasDisconnected,
          replacedSocketId,
        };
      }

      if (room.players.length >= MAX_PLAYERS) throw new GameError('Room is full.');

      const taken = room.players[0]?.symbol;
      const symbol: PlayerSymbol = taken ? oppositeSymbol(taken) : 'X';
      const player = this.createPlayer(name, token, socketId, symbol, room.players.length === 0);
      room.players.push(player);
      if (player.isHost) room.hostId = player.id;

      if (room.players.length === MAX_PLAYERS && room.game.status === 'waiting') {
        room.game = startGame(room.game.round);
      }

      await this.persist(room);
      return { room, player, reconnected: false, announce: true, replacedSocketId: null };
    });
  }

  async makeMove(roomId: string, playerId: string, row: number, col: number): Promise<MoveResult> {
    return withLock(roomId, async () => {
      const room = await this.load(roomId);
      const player = room.players.find((p) => p.id === playerId);
      if (!player) throw new GameError('You are not a player in this room.');
      if (room.players.length < MAX_PLAYERS) throw new GameError('Waiting for an opponent.');
      if (room.players.some((p) => !p.connected)) {
        throw new GameError('Opponent is disconnected. Waiting for them to come back.');
      }

      const { game, move, outcome } = applyMove(room.game, player, row, col);
      room.game = game;
      if (outcome === 'win') player.wins += 1;

      await this.persist(room);
      return { room, move, outcome, player };
    });
  }

  async requestPlayAgain(
    roomId: string,
    playerId: string,
  ): Promise<{ room: RoomRecord; player: PlayerRecord; restarted: boolean }> {
    return withLock(roomId, async () => {
      const room = await this.load(roomId);
      const player = room.players.find((p) => p.id === playerId);
      if (!player) throw new GameError('You are not a player in this room.');
      if (room.game.status !== 'finished') throw new GameError('The match has not finished yet.');

      if (!room.game.playAgainVotes.includes(playerId)) {
        room.game = { ...room.game, playAgainVotes: [...room.game.playAgainVotes, playerId] };
      }

      const everyoneAgreed =
        room.players.length === MAX_PLAYERS &&
        room.players.every((p) => room.game.playAgainVotes.includes(p.id));

      if (everyoneAgreed) {
        // Swap sides each round so both players get to move first (X always starts).
        for (const p of room.players) p.symbol = oppositeSymbol(p.symbol);
        room.game = startGame(room.game.round + 1);
      }

      await this.persist(room);
      return { room, player, restarted: everyoneAgreed };
    });
  }

  async leaveRoom(roomId: string, playerId: string): Promise<LeaveResult | null> {
    return withLock(roomId, async () => {
      const room = await this.repo.get(roomId);
      if (!room) return null;
      const player = room.players.find((p) => p.id === playerId);
      if (!player) return null;

      this.removePlayer(room, playerId);
      return { room: await this.persist(room), player };
    });
  }

  async markDisconnected(
    roomId: string,
    playerId: string,
    socketId: string,
  ): Promise<{ room: RoomRecord; player: PlayerRecord } | null> {
    return withLock(roomId, async () => {
      const room = await this.repo.get(roomId);
      const player = room?.players.find((p) => p.id === playerId);
      // Ignore stale sockets: the seat may already belong to a newer connection.
      if (!room || !player || player.socketId !== socketId || !player.connected) return null;

      player.connected = false;
      player.disconnectedAt = Date.now();
      player.socketId = null;
      await this.persist(room);
      return { room, player };
    });
  }

  /** Called when the grace timer fires; removes the player only if they're still offline. */
  async expireDisconnected(roomId: string, playerId: string): Promise<LeaveResult | null> {
    return withLock(roomId, async () => {
      const room = await this.repo.get(roomId);
      const player = room?.players.find((p) => p.id === playerId);
      if (!room || !player || player.connected) return null;

      this.removePlayer(room, playerId);
      return { room: await this.persist(room), player };
    });
  }

  async addChatMessage(roomId: string, playerId: string, content: string): Promise<ChatMessage> {
    const room = await this.load(roomId);
    const player = room.players.find((p) => p.id === playerId);
    if (!player) throw new GameError('You are not a player in this room.');

    const message: ChatMessage = {
      id: generateId(),
      roomId,
      type: 'user',
      playerId,
      playerName: player.name,
      content,
      createdAt: Date.now(),
    };
    await this.repo.appendChat(roomId, message);
    return message;
  }

  async addSystemMessage(roomId: string, content: string): Promise<ChatMessage> {
    const message: ChatMessage = {
      id: generateId(),
      roomId,
      type: 'system',
      playerId: null,
      playerName: 'System',
      content,
      createdAt: Date.now(),
    };
    await this.repo.appendChat(roomId, message);
    return message;
  }

  getChat(roomId: string): Promise<ChatMessage[]> {
    return this.repo.getChat(roomId);
  }
}
