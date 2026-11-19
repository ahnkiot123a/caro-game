import { BOARD_SIZE, WIN_LENGTH } from '@/lib/constants';
import type { Board, BoardCell, CellValue } from '@/types/game';

const DIRECTIONS: ReadonlyArray<readonly [number, number]> = [
  [0, 1], // horizontal
  [1, 0], // vertical
  [1, 1], // main diagonal (top-left -> bottom-right)
  [1, -1], // anti diagonal (top-right -> bottom-left)
];

export function createEmptyBoard(size: number = BOARD_SIZE): Board {
  return Array.from({ length: size }, () => Array<CellValue>(size).fill(null));
}

export function isInside(board: Board, row: number, col: number): boolean {
  return row >= 0 && row < board.length && col >= 0 && col < board[row].length;
}

/**
 * Checks whether the stone just placed at (row, col) creates a line of at least
 * WIN_LENGTH identical stones. Only the 4 lines passing through the last move are
 * scanned, each at most (WIN_LENGTH - 1) cells in both directions, so the cost is
 * O(WIN_LENGTH) regardless of board size.
 *
 * @returns the winning cells (ordered) or null when there is no winner.
 */
export function checkWinner(board: Board, row: number, col: number): BoardCell[] | null {
  if (!isInside(board, row, col)) return null;
  const value = board[row][col];
  if (value === null) return null;

  for (const [dr, dc] of DIRECTIONS) {
    const backward: BoardCell[] = [];
    const forward: BoardCell[] = [];

    for (let step = 1; step < WIN_LENGTH; step++) {
      const r = row - dr * step;
      const c = col - dc * step;
      if (!isInside(board, r, c) || board[r][c] !== value) break;
      backward.push({ row: r, col: c, value });
    }

    for (let step = 1; step < WIN_LENGTH; step++) {
      const r = row + dr * step;
      const c = col + dc * step;
      if (!isInside(board, r, c) || board[r][c] !== value) break;
      forward.push({ row: r, col: c, value });
    }

    if (backward.length + 1 + forward.length >= WIN_LENGTH) {
      return [...backward.reverse(), { row, col, value }, ...forward];
    }
  }

  return null;
}

export function isBoardFull(board: Board): boolean {
  return board.every((line) => line.every((cell) => cell !== null));
}
