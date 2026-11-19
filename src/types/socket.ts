import type { BoardCell, ChatMessage, Move, Player, PlayerSymbol, Room } from './game';

export interface AckResult<T = undefined> {
  ok: boolean;
  error?: string;
  data?: T;
}

export type Ack<T = undefined> = (response: AckResult<T>) => void;

export interface CreateRoomPayload {
  name: string;
  token: string;
}

export interface CreateRoomResult {
  roomId: string;
  room: Room;
  playerId: string;
  chat: ChatMessage[];
}

export interface JoinRoomPayload {
  roomId: string;
  name: string;
  token: string;
}

export interface MovePayload {
  roomId: string;
  row: number;
  col: number;
}

export interface ChatPayload {
  roomId: string;
  content: string;
}

export interface RoomScopedPayload {
  roomId: string;
}

export interface RoomJoinedEvent {
  room: Room;
  playerId: string;
  chat: ChatMessage[];
  reconnected: boolean;
}

export interface PlayerJoinedEvent {
  player: Player;
  reconnected: boolean;
}

export type PlayerLeftReason = 'left' | 'disconnected' | 'timeout' | 'replaced';

export interface PlayerLeftEvent {
  playerId: string;
  playerName: string;
  reason: PlayerLeftReason;
}

export interface MoveMadeEvent {
  move: Move;
  nextTurn: PlayerSymbol;
}

export interface GameWonEvent {
  winnerId: string;
  winnerName: string;
  symbol: PlayerSymbol;
  line: BoardCell[];
}

export interface PlayAgainRequestEvent {
  playerId: string;
  playerName: string;
  votes: string[];
}

export interface ClientToServerEvents {
  'create-room': (payload: CreateRoomPayload, ack: Ack<CreateRoomResult>) => void;
  'join-room': (payload: JoinRoomPayload, ack: Ack<{ roomId: string; playerId: string }>) => void;
  move: (payload: MovePayload, ack: Ack) => void;
  'chat-message': (payload: ChatPayload, ack: Ack) => void;
  'play-again': (payload: RoomScopedPayload, ack: Ack) => void;
  'leave-room': (payload: RoomScopedPayload, ack: Ack) => void;
}

export interface ServerToClientEvents {
  'room-created': (room: Room) => void;
  'room-joined': (event: RoomJoinedEvent) => void;
  'player-joined': (event: PlayerJoinedEvent) => void;
  'player-left': (event: PlayerLeftEvent) => void;
  'move-made': (event: MoveMadeEvent) => void;
  'game-won': (event: GameWonEvent) => void;
  draw: () => void;
  'play-again-request': (event: PlayAgainRequestEvent) => void;
  'room-updated': (room: Room) => void;
  'chat-message': (message: ChatMessage) => void;
  'room-error': (event: { message: string }) => void;
}

export type InterServerEvents = Record<string, never>;

export interface SocketData {
  roomId: string | null;
  playerId: string | null;
}
