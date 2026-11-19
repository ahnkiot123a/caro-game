import type { ChatMessage, GameState, Player } from '@/types/game';

/** Server-only player data. `tokenHash` and `socketId` are never sent to clients. */
export interface PlayerRecord extends Player {
  tokenHash: string;
  socketId: string | null;
}

export interface RoomMeta {
  id: string;
  hostId: string;
  createdAt: number;
  updatedAt: number;
}

export interface RoomRecord extends RoomMeta {
  players: PlayerRecord[];
  game: GameState;
}

export interface RoomRepository {
  readonly kind: 'redis' | 'memory';
  get(roomId: string): Promise<RoomRecord | null>;
  exists(roomId: string): Promise<boolean>;
  save(room: RoomRecord, initialMessage?: ChatMessage): Promise<void>;
  delete(roomId: string): Promise<void>;
  appendChat(roomId: string, message: ChatMessage): Promise<void>;
  getChat(roomId: string): Promise<ChatMessage[]>;
}
