export type PlayerSymbol = 'X' | 'O';

export type CellValue = PlayerSymbol | null;

/** 2D board, indexed as board[row][col]. */
export type Board = CellValue[][];

export interface BoardCell {
  row: number;
  col: number;
  value: CellValue;
}

export interface Player {
  id: string;
  name: string;
  symbol: PlayerSymbol;
  isHost: boolean;
  connected: boolean;
  /** Epoch ms when the player disconnected; null while connected. */
  disconnectedAt: number | null;
  joinedAt: number;
  wins: number;
}

export interface Move {
  row: number;
  col: number;
  symbol: PlayerSymbol;
  playerId: string;
  moveNumber: number;
  timestamp: number;
}

export type GameStatus = 'waiting' | 'playing' | 'finished';

export type GameResult = 'win' | 'draw' | null;

export interface GameState {
  board: Board;
  status: GameStatus;
  currentTurn: PlayerSymbol;
  moves: Move[];
  lastMove: Move | null;
  result: GameResult;
  winnerId: string | null;
  winnerSymbol: PlayerSymbol | null;
  winningLine: BoardCell[] | null;
  /** Player ids who pressed "Play Again" after the match finished. */
  playAgainVotes: string[];
  round: number;
}

export interface Room {
  id: string;
  hostId: string;
  players: Player[];
  game: GameState;
  createdAt: number;
  updatedAt: number;
}

export type ChatMessageType = 'user' | 'system';

export interface ChatMessage {
  id: string;
  roomId: string;
  type: ChatMessageType;
  playerId: string | null;
  playerName: string;
  content: string;
  createdAt: number;
}
