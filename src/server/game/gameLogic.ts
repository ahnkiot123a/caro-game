import { BOARD_SIZE } from '@/lib/constants';
import type { GameState, Move, PlayerSymbol } from '@/types/game';
import { checkWinner, createEmptyBoard } from '@/utils/checkWinner';
import type { PlayerRecord } from './types';

export class GameError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'GameError';
  }
}

export type MoveOutcome = 'continue' | 'win' | 'draw';

export function createGameState(round = 1): GameState {
  return {
    board: createEmptyBoard(),
    status: 'waiting',
    currentTurn: 'X',
    moves: [],
    lastMove: null,
    result: null,
    winnerId: null,
    winnerSymbol: null,
    winningLine: null,
    playAgainVotes: [],
    round,
  };
}

export function startGame(round: number): GameState {
  return { ...createGameState(round), status: 'playing' };
}

export function oppositeSymbol(symbol: PlayerSymbol): PlayerSymbol {
  return symbol === 'X' ? 'O' : 'X';
}

export function applyMove(
  game: GameState,
  player: PlayerRecord,
  row: number,
  col: number,
): { game: GameState; move: Move; outcome: MoveOutcome } {
  if (game.status !== 'playing') throw new GameError('The match is not in progress.');
  if (player.symbol !== game.currentTurn) throw new GameError("It's not your turn.");
  if (
    !Number.isInteger(row) ||
    !Number.isInteger(col) ||
    row < 0 ||
    col < 0 ||
    row >= BOARD_SIZE ||
    col >= BOARD_SIZE
  ) {
    throw new GameError('Invalid cell.');
  }
  if (game.board[row][col] !== null) throw new GameError('That cell is already taken.');

  const board = game.board.map((line) => [...line]);
  board[row][col] = player.symbol;

  const move: Move = {
    row,
    col,
    symbol: player.symbol,
    playerId: player.id,
    moveNumber: game.moves.length + 1,
    timestamp: Date.now(),
  };

  const next: GameState = {
    ...game,
    board,
    moves: [...game.moves, move],
    lastMove: move,
  };

  const line = checkWinner(board, row, col);
  if (line) {
    return {
      move,
      outcome: 'win',
      game: {
        ...next,
        status: 'finished',
        result: 'win',
        winnerId: player.id,
        winnerSymbol: player.symbol,
        winningLine: line,
      },
    };
  }

  if (next.moves.length >= BOARD_SIZE * BOARD_SIZE) {
    return { move, outcome: 'draw', game: { ...next, status: 'finished', result: 'draw' } };
  }

  return {
    move,
    outcome: 'continue',
    game: { ...next, currentTurn: oppositeSymbol(player.symbol) },
  };
}
