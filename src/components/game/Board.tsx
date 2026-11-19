'use client';

import { useMemo } from 'react';
import { BOARD_CELL_SIZE } from '@/lib/constants';
import type { Board as BoardData, BoardCell, PlayerSymbol } from '@/types/game';
import { cn } from '@/utils/format';
import { Cell } from './Cell';

interface BoardProps {
  board: BoardData;
  lastMove: { row: number; col: number } | null;
  winningLine: BoardCell[] | null;
  disabled: boolean;
  hoverSymbol: PlayerSymbol | null;
  finished?: boolean;
  /** Must be referentially stable so memoized cells don't re-render. */
  onPlay: (row: number, col: number) => void;
}

/** Presentational BOARD_SIZE x BOARD_SIZE grid shared by the online and vs-computer modes. */
export function Board({
  board,
  lastMove,
  winningLine,
  disabled,
  hoverSymbol,
  finished = false,
  onPlay,
}: BoardProps) {
  const winningSet = useMemo(
    () => new Set(winningLine?.map((c) => `${c.row}:${c.col}`) ?? []),
    [winningLine],
  );

  return (
    <div
      role="region"
      tabIndex={0}
      aria-label="Scrollable Caro board"
      className="mx-auto max-h-[75dvh] w-full max-w-full overflow-auto rounded-xl sm:max-h-none sm:overflow-visible"
    >
      <div
        className={cn(
          'relative mx-auto grid aspect-square w-full overflow-hidden rounded-xl border-t border-l border-slate-700/60 bg-slate-900/80 shadow-2xl shadow-indigo-950/40 transition-opacity',
          finished && 'opacity-90',
        )}
        style={{
          width: `${board.length * BOARD_CELL_SIZE}px`,
          gridTemplateColumns: `repeat(${board.length}, minmax(0, 1fr))`,
        }}
        role="grid"
        aria-label="Caro board"
      >
        {board.map((line, row) =>
          line.map((value, col) => (
            <Cell
              key={`${row}:${col}`}
              row={row}
              col={col}
              value={value}
              disabled={disabled}
              isLastMove={lastMove?.row === row && lastMove?.col === col}
              isWinning={winningSet.has(`${row}:${col}`)}
              hoverSymbol={hoverSymbol}
              onPlay={onPlay}
            />
          )),
        )}
      </div>
    </div>
  );
}
