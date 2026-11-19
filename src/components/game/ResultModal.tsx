'use client';

import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/Button';
import { socketService } from '@/services/socketService';
import { useGameStore } from '@/store/gameStore';
import type { Room } from '@/types/game';

interface ResultModalProps {
  room: Room;
  playerId: string;
}

export function ResultModal({ room, playerId }: ResultModalProps) {
  const pushToast = useGameStore((s) => s.pushToast);
  const { game } = room;
  const [hidden, setHidden] = useState(false);
  const [pending, setPending] = useState(false);

  // Re-open the popup for every newly finished round.
  useEffect(() => setHidden(false), [game.round, game.status]);

  if (game.status !== 'finished' || hidden) return null;

  const won = game.winnerId === playerId;
  const winner = room.players.find((p) => p.id === game.winnerId);
  const opponent = room.players.find((p) => p.id !== playerId);
  const iVoted = game.playAgainVotes.includes(playerId);
  const opponentVoted = opponent ? game.playAgainVotes.includes(opponent.id) : false;

  const title = game.result === 'draw' ? 'Draw!' : won ? 'Victory!' : 'Defeat';
  const subtitle =
    game.result === 'draw'
      ? 'The board is full. Nobody wins this round.'
      : won
        ? 'Five in a row — well played!'
        : `${winner?.name ?? 'Your opponent'} got five in a row.`;

  const handlePlayAgain = async () => {
    setPending(true);
    const result = await socketService.playAgain(room.id);
    setPending(false);
    if (!result.ok) pushToast(result.error ?? 'Could not request a rematch.', 'error');
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="result-title"
      className="animate-fade-in fixed inset-0 z-40 flex items-center justify-center bg-slate-950/70 p-4 backdrop-blur-sm"
    >
      <div className="animate-pop-in w-full max-w-sm rounded-2xl border border-slate-700 bg-slate-900 p-6 text-center shadow-2xl">
        <div className="mb-3 text-5xl">{game.result === 'draw' ? '🤝' : won ? '🏆' : '😔'}</div>
        <h2
          id="result-title"
          className={
            won
              ? 'bg-gradient-to-r from-amber-300 to-yellow-500 bg-clip-text text-3xl font-black text-transparent'
              : 'text-3xl font-black text-slate-100'
          }
        >
          {title}
        </h2>
        <p className="mt-2 text-sm text-slate-400">{subtitle}</p>

        <div className="mt-4 flex justify-center gap-6 text-sm">
          {room.players.map((p) => (
            <div key={p.id} className="flex flex-col items-center">
              <span className="max-w-[8rem] truncate text-slate-300">{p.name}</span>
              <span className="text-2xl font-bold text-white">{p.wins}</span>
            </div>
          ))}
        </div>

        <div className="mt-6 space-y-2">
          <Button
            className="w-full"
            size="lg"
            onClick={handlePlayAgain}
            loading={pending}
            disabled={iVoted || !opponent || !opponent.connected}
          >
            {iVoted ? 'Waiting for opponent…' : 'Play Again'}
          </Button>
          <p className="text-xs text-slate-500">
            {!opponent
              ? 'Your opponent left the room.'
              : opponentVoted && !iVoted
                ? `${opponent.name} wants a rematch!`
                : 'Both players must agree to start a new round.'}
          </p>
          <Button variant="ghost" size="sm" onClick={() => setHidden(true)}>
            View board
          </Button>
        </div>
      </div>
    </div>
  );
}
