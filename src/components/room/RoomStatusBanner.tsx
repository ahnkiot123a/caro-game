'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/Button';
import { useCountdown } from '@/hooks/useCountdown';
import { RECONNECT_GRACE_MS } from '@/lib/constants';
import { socketService } from '@/services/socketService';
import { useGameStore } from '@/store/gameStore';
import type { Room } from '@/types/game';
import { cn } from '@/utils/format';
import { getRoomStatus, type RoomStatusKind } from '@/utils/roomStatus';

const styles: Record<RoomStatusKind, string> = {
  connecting: 'border-slate-700 bg-slate-800/60 text-slate-300',
  waiting: 'border-amber-500/30 bg-amber-500/10 text-amber-200',
  'your-turn':
    'border-emerald-500/40 bg-emerald-500/10 text-emerald-200 shadow-lg shadow-emerald-500/10',
  'opponent-turn': 'border-sky-500/30 bg-sky-500/10 text-sky-200',
  'opponent-disconnected': 'border-rose-500/40 bg-rose-500/10 text-rose-200',
  finished: 'border-violet-500/40 bg-violet-500/10 text-violet-200',
};

interface RoomStatusBannerProps {
  room: Room;
  playerId: string;
}

export function RoomStatusBanner({ room, playerId }: RoomStatusBannerProps) {
  const pushToast = useGameStore((s) => s.pushToast);
  const status = getRoomStatus(room, playerId);
  const deadline =
    status.kind === 'opponent-disconnected' && status.opponent?.disconnectedAt
      ? status.opponent.disconnectedAt + RECONNECT_GRACE_MS
      : null;
  const secondsLeft = useCountdown(deadline);
  const [pending, setPending] = useState(false);

  let detail = '';
  switch (status.kind) {
    case 'waiting':
      detail = 'Share the room ID or invite link with a friend.';
      break;
    case 'your-turn':
      detail = `You play ${status.me?.symbol}. Place your stone.`;
      break;
    case 'opponent-turn':
      detail = `${status.opponent?.name ?? 'Opponent'} is thinking…`;
      break;
    case 'opponent-disconnected':
      detail = `Holding their seat for ${secondsLeft}s.`;
      break;
    case 'finished':
      detail =
        room.game.result === 'draw'
          ? 'Draw.'
          : room.game.winnerId === playerId
            ? 'You won!'
            : `${room.players.find((p) => p.id === room.game.winnerId)?.name ?? 'Opponent'} won.`;
      break;
  }

  const voted = room.game.playAgainVotes.includes(playerId);

  const playAgain = async () => {
    setPending(true);
    const result = await socketService.playAgain(room.id);
    setPending(false);
    if (!result.ok) pushToast(result.error ?? 'Could not request a rematch.', 'error');
  };

  return (
    <div
      role="status"
      className={cn(
        'flex flex-wrap items-center justify-between gap-3 rounded-2xl border px-4 py-3 transition-colors duration-300',
        styles[status.kind],
      )}
    >
      <div className="flex items-center gap-3">
        {status.kind === 'your-turn' && (
          <span className="relative flex size-3">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
            <span className="relative inline-flex size-3 rounded-full bg-emerald-400" />
          </span>
        )}
        <div>
          <p className="text-lg font-bold">{status.label}</p>
          <p className="text-sm opacity-80">{detail}</p>
        </div>
      </div>
      {status.kind === 'finished' && status.opponent && (
        <Button
          size="sm"
          onClick={playAgain}
          loading={pending}
          disabled={voted || !status.opponent.connected}
        >
          {voted ? 'Waiting for opponent…' : 'Play Again'}
        </Button>
      )}
    </div>
  );
}
