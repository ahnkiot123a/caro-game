'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Board } from '@/components/game/Board';
import { Button } from '@/components/ui/Button';
import { Card, CardHeader, CardTitle } from '@/components/ui/Card';
import { useAiGame } from '@/hooks/useAiGame';
import type { PlayerSymbol } from '@/types/game';
import { cn } from '@/utils/format';
import { AiResultModal } from './AiResultModal';

const symbolStyle = (symbol: PlayerSymbol) =>
  symbol === 'X' ? 'bg-sky-500/15 text-sky-400' : 'bg-rose-500/15 text-rose-400';
const glyph = (symbol: PlayerSymbol) => (symbol === 'X' ? '✕' : '◯');

export function AiGameView() {
  const router = useRouter();
  const { state, thinking, aiSymbol, play, start, backToSetup } = useAiGame();
  const [humanFirst, setHumanFirst] = useState(true);

  if (state.phase === 'setup') {
    return (
      <Card className="mx-auto w-full max-w-md p-6 sm:p-8">
        <h1 className="text-2xl font-black text-white">Play vs Computer</h1>
        <p className="mt-1 text-sm text-slate-400">
          Hard difficulty · X always moves first. Who should start?
        </p>
        <div role="radiogroup" aria-label="Who goes first" className="mt-6 grid grid-cols-2 gap-3">
          {[
            { value: true, label: 'Me', hint: 'You play ✕' },
            { value: false, label: 'Computer', hint: 'You play ◯' },
          ].map((option) => (
            <button
              key={option.label}
              type="button"
              role="radio"
              aria-checked={humanFirst === option.value}
              onClick={() => setHumanFirst(option.value)}
              className={cn(
                'cursor-pointer rounded-xl border px-4 py-3 text-left transition',
                humanFirst === option.value
                  ? 'border-indigo-500 bg-indigo-500/15 text-white'
                  : 'border-slate-700 bg-slate-900/60 text-slate-300 hover:border-slate-500',
              )}
            >
              <span className="block font-semibold">{option.label}</span>
              <span className="text-xs text-slate-400">{option.hint}</span>
            </button>
          ))}
        </div>
        <Button size="lg" className="mt-6 w-full" onClick={() => start(humanFirst)}>
          Start game
        </Button>
        <Button variant="ghost" className="mt-2 w-full" onClick={() => router.push('/')}>
          Back to home
        </Button>
      </Card>
    );
  }

  const { outcome, humanSymbol, stats } = state;
  const status =
    state.phase === 'finished'
      ? {
          label: 'Match finished',
          detail: outcome === 'human' ? 'You won!' : outcome === 'ai' ? 'Computer won.' : 'Draw.',
          tone: 'border-violet-500/40 bg-violet-500/10 text-violet-200',
        }
      : thinking
        ? {
            label: 'Computer turn',
            detail: 'Computer is thinking…',
            tone: 'border-sky-500/30 bg-sky-500/10 text-sky-200',
          }
        : {
            label: 'Your turn',
            detail: `You play ${humanSymbol}. Place your stone.`,
            tone: 'border-emerald-500/40 bg-emerald-500/10 text-emerald-200 shadow-lg shadow-emerald-500/10',
          };

  const players = [
    { name: 'You', symbol: humanSymbol, score: stats.wins, active: !thinking },
    { name: 'Computer', symbol: aiSymbol, score: stats.losses, active: thinking },
  ];

  return (
    <div className="grid w-full gap-4 xl:grid-cols-[minmax(0,1fr)_260px]">
      <div className="space-y-4">
        <div
          role="status"
          className={cn(
            'flex items-center gap-3 rounded-2xl border px-4 py-3 transition-colors duration-300',
            status.tone,
          )}
        >
          {thinking && (
            <span className="size-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
          )}
          <div>
            <p className="text-lg font-bold">{status.label}</p>
            <p className="text-sm opacity-80">{status.detail}</p>
          </div>
        </div>
        <Board
          board={state.board}
          lastMove={state.lastMove}
          winningLine={state.winningLine}
          disabled={state.phase !== 'playing' || thinking}
          hoverSymbol={humanSymbol}
          finished={state.phase === 'finished'}
          onPlay={play}
        />
      </div>

      <aside className="flex flex-col gap-4">
        <Card>
          <CardHeader>
            <CardTitle>Players</CardTitle>
            <span className="text-xs text-slate-500">Draws {stats.draws}</span>
          </CardHeader>
          <ul className="divide-y divide-slate-800">
            {players.map((p) => (
              <li
                key={p.name}
                className={cn(
                  'flex items-center gap-3 px-4 py-3 transition-colors',
                  state.phase === 'playing' && p.active && 'bg-indigo-500/10',
                )}
              >
                <span
                  className={cn(
                    'flex size-9 items-center justify-center rounded-lg text-lg font-black',
                    symbolStyle(p.symbol),
                  )}
                >
                  {glyph(p.symbol)}
                </span>
                <span className="flex-1 font-medium text-slate-100">{p.name}</span>
                <span className="text-sm font-semibold text-slate-300" title="Wins">
                  {p.score}W
                </span>
              </li>
            ))}
          </ul>
        </Card>
        <Card className="space-y-2 p-4">
          <p className="text-xs text-slate-500">Move {state.moveCount} · Hard difficulty</p>
          <Button className="w-full" onClick={() => start(humanFirst)}>
            New game
          </Button>
          <Button variant="secondary" className="w-full" onClick={backToSetup}>
            Change who goes first
          </Button>
          <Button variant="ghost" className="w-full" onClick={() => router.push('/')}>
            Back to home
          </Button>
        </Card>
      </aside>

      <AiResultModal
        state={state}
        onPlayAgain={() => start(humanFirst)}
        onChangeSettings={backToSetup}
      />
    </div>
  );
}
