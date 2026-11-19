'use client';

import { Card, CardHeader, CardTitle } from '@/components/ui/Card';
import { MAX_PLAYERS } from '@/lib/constants';
import type { Room } from '@/types/game';
import { cn } from '@/utils/format';

interface PlayerListProps {
  room: Room;
  playerId: string;
}

export function PlayerList({ room, playerId }: PlayerListProps) {
  const emptySeats = Math.max(0, MAX_PLAYERS - room.players.length);
  const playing = room.game.status === 'playing';

  return (
    <Card>
      <CardHeader>
        <CardTitle>Players</CardTitle>
        <span className="text-xs text-slate-500">
          {room.players.length}/{MAX_PLAYERS}
        </span>
      </CardHeader>
      <ul className="divide-y divide-slate-800">
        {room.players.map((player) => {
          const isTurn = playing && room.game.currentTurn === player.symbol;
          return (
            <li
              key={player.id}
              className={cn(
                'flex items-center gap-3 px-4 py-3 transition-colors',
                isTurn && 'bg-indigo-500/10',
              )}
            >
              <span
                className={cn(
                  'flex size-9 shrink-0 items-center justify-center rounded-lg text-lg font-black',
                  player.symbol === 'X'
                    ? 'bg-sky-500/15 text-sky-400'
                    : 'bg-rose-500/15 text-rose-400',
                )}
              >
                {player.symbol === 'X' ? '✕' : '◯'}
              </span>
              <div className="min-w-0 flex-1">
                <p className="flex items-center gap-2 truncate font-medium text-slate-100">
                  <span className="truncate">{player.name}</span>
                  {player.id === playerId && (
                    <span className="rounded bg-indigo-500/20 px-1.5 py-0.5 text-[10px] font-semibold text-indigo-300 uppercase">
                      You
                    </span>
                  )}
                  {player.isHost && (
                    <span className="rounded bg-amber-500/15 px-1.5 py-0.5 text-[10px] font-semibold text-amber-300 uppercase">
                      Host
                    </span>
                  )}
                </p>
                <p className="flex items-center gap-1.5 text-xs text-slate-400">
                  <span
                    className={cn(
                      'size-1.5 rounded-full',
                      player.connected ? 'bg-emerald-400' : 'animate-pulse bg-rose-400',
                    )}
                  />
                  {player.connected ? (isTurn ? 'Thinking…' : 'Online') : 'Disconnected'}
                </p>
              </div>
              <span className="text-sm font-semibold text-slate-300" title="Wins">
                {player.wins}W
              </span>
            </li>
          );
        })}
        {Array.from({ length: emptySeats }, (_, i) => (
          <li key={`empty-${i}`} className="flex items-center gap-3 px-4 py-3 text-slate-500">
            <span className="flex size-9 items-center justify-center rounded-lg border border-dashed border-slate-700">
              ?
            </span>
            <span className="text-sm italic">Waiting for player…</span>
          </li>
        ))}
      </ul>
    </Card>
  );
}
