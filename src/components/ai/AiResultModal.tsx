'use client';

import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/Button';
import type { AiGameState } from '@/hooks/useAiGame';

interface AiResultModalProps {
  state: AiGameState;
  onPlayAgain: () => void;
  onChangeSettings: () => void;
}

const content = {
  human: { icon: '🏆', title: 'Victory!', subtitle: 'You beat the computer — impressive!' },
  ai: { icon: '🤖', title: 'Defeat', subtitle: 'The computer got five in a row.' },
  draw: { icon: '🤝', title: 'Draw!', subtitle: 'The board is full. Nobody wins this round.' },
} as const;

export function AiResultModal({ state, onPlayAgain, onChangeSettings }: AiResultModalProps) {
  const [hidden, setHidden] = useState(false);

  useEffect(() => setHidden(false), [state.gameId]);

  if (state.phase !== 'finished' || !state.outcome || hidden) return null;
  const { icon, title, subtitle } = content[state.outcome];
  const { wins, losses, draws } = state.stats;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="ai-result-title"
      className="animate-fade-in fixed inset-0 z-40 flex items-center justify-center bg-slate-950/70 p-4 backdrop-blur-sm"
    >
      <div className="animate-pop-in w-full max-w-sm rounded-2xl border border-slate-700 bg-slate-900 p-6 text-center shadow-2xl">
        <div className="mb-3 text-5xl">{icon}</div>
        <h2
          id="ai-result-title"
          className={
            state.outcome === 'human'
              ? 'bg-gradient-to-r from-amber-300 to-yellow-500 bg-clip-text text-3xl font-black text-transparent'
              : 'text-3xl font-black text-slate-100'
          }
        >
          {title}
        </h2>
        <p className="mt-2 text-sm text-slate-400">{subtitle}</p>
        <p className="mt-4 text-sm text-slate-300">
          You {wins} · Computer {losses} · Draws {draws}
        </p>
        <div className="mt-6 space-y-2">
          <Button className="w-full" size="lg" onClick={onPlayAgain}>
            Play Again
          </Button>
          <div className="flex justify-center gap-2">
            <Button variant="ghost" size="sm" onClick={onChangeSettings}>
              Change who goes first
            </Button>
            <Button variant="ghost" size="sm" onClick={() => setHidden(true)}>
              View board
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
