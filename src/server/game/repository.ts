import type { Redis } from '@upstash/redis';
import { MAX_CHAT_HISTORY, ROOM_TTL_SECONDS } from '@/lib/constants';
import { getRedis } from '@/lib/redis';
import type { ChatMessage, GameState } from '@/types/game';
import type { PlayerRecord, RoomMeta, RoomRecord, RoomRepository } from './types';

const keys = {
  meta: (id: string) => `caro:room:${id}`,
  game: (id: string) => `caro:room:${id}:game`,
  players: (id: string) => `caro:room:${id}:players`,
  chat: (id: string) => `caro:room:${id}:chat`,
};

/**
 * Upstash Redis storage layout (all keys share the same TTL, refreshed on every write):
 *  - caro:room:{id}          -> JSON RoomMeta
 *  - caro:room:{id}:game     -> JSON GameState (board, moves, turn, result)
 *  - caro:room:{id}:players  -> HASH playerId -> JSON PlayerRecord
 *  - caro:room:{id}:chat     -> LIST of JSON ChatMessage (capped)
 */
export class RedisRoomRepository implements RoomRepository {
  readonly kind = 'redis' as const;

  constructor(private readonly redis: Redis) {}

  async get(roomId: string): Promise<RoomRecord | null> {
    const [meta, game, players] = await this.redis
      .pipeline()
      .get<RoomMeta>(keys.meta(roomId))
      .get<GameState>(keys.game(roomId))
      .hgetall<Record<string, PlayerRecord>>(keys.players(roomId))
      .exec<[RoomMeta | null, GameState | null, Record<string, PlayerRecord> | null]>();

    if (!meta || !game) return null;

    const playerList = Object.values(players ?? {}).sort((a, b) => a.joinedAt - b.joinedAt);
    return { ...meta, game, players: playerList };
  }

  async exists(roomId: string): Promise<boolean> {
    return (await this.redis.exists(keys.meta(roomId))) === 1;
  }

  async save(room: RoomRecord, initialMessage?: ChatMessage): Promise<void> {
    const { players, game, ...meta } = room;
    const tx = this.redis.multi();
    tx.set(keys.meta(room.id), meta, { ex: ROOM_TTL_SECONDS });
    tx.set(keys.game(room.id), game, { ex: ROOM_TTL_SECONDS });
    tx.del(keys.players(room.id));
    if (players.length > 0) {
      tx.hset(keys.players(room.id), Object.fromEntries(players.map((p) => [p.id, p])));
      tx.expire(keys.players(room.id), ROOM_TTL_SECONDS);
    }
    if (initialMessage) {
      tx.rpush(keys.chat(room.id), initialMessage);
      tx.ltrim(keys.chat(room.id), -MAX_CHAT_HISTORY, -1);
    }
    tx.expire(keys.chat(room.id), ROOM_TTL_SECONDS);
    await tx.exec();
  }

  async delete(roomId: string): Promise<void> {
    await this.redis.del(
      keys.meta(roomId),
      keys.game(roomId),
      keys.players(roomId),
      keys.chat(roomId),
    );
  }

  async appendChat(roomId: string, message: ChatMessage): Promise<void> {
    await this.redis
      .pipeline()
      .rpush(keys.chat(roomId), message)
      .ltrim(keys.chat(roomId), -MAX_CHAT_HISTORY, -1)
      .expire(keys.chat(roomId), ROOM_TTL_SECONDS)
      .exec();
  }

  async getChat(roomId: string): Promise<ChatMessage[]> {
    return this.redis.lrange<ChatMessage>(keys.chat(roomId), 0, -1);
  }
}

interface MemoryEntry {
  room: string;
  chat: ChatMessage[];
  expiresAt: number;
}

/**
 * Process-local store used automatically when Upstash credentials are absent.
 * Values are serialized to JSON so behaviour matches Redis (no shared references).
 * Suitable for local development or a single-instance deployment only.
 */
export class MemoryRoomRepository implements RoomRepository {
  readonly kind = 'memory' as const;
  private readonly store = new Map<string, MemoryEntry>();

  constructor() {
    const sweeper = setInterval(() => this.sweep(), 60_000);
    sweeper.unref?.();
  }

  private sweep(): void {
    const now = Date.now();
    for (const [id, entry] of this.store) {
      if (entry.expiresAt <= now) this.store.delete(id);
    }
  }

  private entry(roomId: string): MemoryEntry | null {
    const entry = this.store.get(roomId);
    if (!entry) return null;
    if (entry.expiresAt <= Date.now()) {
      this.store.delete(roomId);
      return null;
    }
    return entry;
  }

  async get(roomId: string): Promise<RoomRecord | null> {
    const entry = this.entry(roomId);
    return entry ? (JSON.parse(entry.room) as RoomRecord) : null;
  }

  async exists(roomId: string): Promise<boolean> {
    return this.entry(roomId) !== null;
  }

  async save(room: RoomRecord, initialMessage?: ChatMessage): Promise<void> {
    const existing = this.entry(room.id);
    const chat = existing?.chat ?? [];
    if (initialMessage) {
      chat.push(structuredClone(initialMessage));
      if (chat.length > MAX_CHAT_HISTORY)
        chat.splice(0, chat.length - MAX_CHAT_HISTORY);
    }
    this.store.set(room.id, {
      room: JSON.stringify(room),
      chat,
      expiresAt: Date.now() + ROOM_TTL_SECONDS * 1000,
    });
  }

  async delete(roomId: string): Promise<void> {
    this.store.delete(roomId);
  }

  async appendChat(roomId: string, message: ChatMessage): Promise<void> {
    const entry = this.entry(roomId);
    if (!entry) return;
    entry.chat.push(structuredClone(message));
    if (entry.chat.length > MAX_CHAT_HISTORY)
      entry.chat.splice(0, entry.chat.length - MAX_CHAT_HISTORY);
  }

  async getChat(roomId: string): Promise<ChatMessage[]> {
    return structuredClone(this.entry(roomId)?.chat ?? []);
  }
}

let repository: RoomRepository | null = null;

export function getRoomRepository(): RoomRepository {
  if (repository) return repository;
  const redis = getRedis();
  repository = redis ? new RedisRoomRepository(redis) : new MemoryRoomRepository();
  if (repository.kind === 'memory') {
    console.warn(
      '[caro] UPSTASH_REDIS_REST_URL/TOKEN not set - using in-memory room store (single instance only).',
    );
  } else {
    console.info('[caro] Using Upstash Redis room store.');
  }
  return repository;
}
