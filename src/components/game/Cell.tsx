'use client';

import { memo } from 'react';
import type { CellValue } from '@/types/game';
import { cn } from '@/utils/format';

interface CellProps {
  row: number;
  col: number;
  value: CellValue;
  disabled: boolean;
  isLastMove: boolean;
  isWinning: boolean;
  hoverSymbol: 'X' | 'O' | null;
  onPlay: (row: number, col: number) => void;
}

export const Cell = memo(function Cell({
  row,
  col,
  value,
  disabled,
  isLastMove,
  isWinning,
  hoverSymbol,
  onPlay,
}: CellProps) {
  const playable = !disabled && value === null;

  return (
    <button
      type="button"
      aria-label={`Row ${row + 1}, column ${col + 1}${value ? `, ${value}` : ''}`}
      disabled={!playable}
      onClick={() => onPlay(row, col)}
      className={cn(
        'group relative flex aspect-square items-center justify-center border-r border-b border-slate-700/60 transition-colors duration-150',
        playable ? 'cursor-pointer hover:bg-indigo-500/15' : 'cursor-default',
        isWinning && 'animate-win-pulse bg-amber-400/25',
        isLastMove && !isWinning && 'bg-slate-700/40',
      )}
    >
      {value && (
        <span
          className={cn(
            'animate-stone-in text-[clamp(0.6rem,2.8vw,1.1rem)] leading-none font-black select-none',
            value === 'X'
              ? 'text-sky-400 drop-shadow-[0_0_6px_rgba(56,189,248,0.6)]'
              : 'text-rose-400 drop-shadow-[0_0_6px_rgba(251,113,133,0.6)]',
          )}
        >
          {value === 'X' ? '✕' : '◯'}
        </span>
      )}
      {!value && playable && hoverSymbol && (
        <span
          aria-hidden="true"
          className={cn(
            'text-[clamp(0.6rem,2.8vw,1.1rem)] leading-none font-black opacity-0 transition-opacity select-none group-hover:opacity-30',
            hoverSymbol === 'X' ? 'text-sky-400' : 'text-rose-400',
          )}
        >
          {hoverSymbol === 'X' ? '✕' : '◯'}
        </span>
      )}
      {isLastMove && (
        <span className="pointer-events-none absolute inset-px rounded-sm ring-1 ring-amber-300/70 sm:ring-2" />
      )}
    </button>
  );
});
