'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import type { ConnectionState } from '@/store/gameStore';
import type { Room } from '@/types/game';
import { cn } from '@/utils/format';

interface RoomInfoProps {
  room: Room;
  connection: ConnectionState;
  onLeave: () => void;
  leaving: boolean;
}

const connectionLabel: Record<ConnectionState, { text: string; dot: string }> = {
  idle: { text: 'Offline', dot: 'bg-slate-500' },
  connecting: { text: 'Connecting', dot: 'bg-amber-400 animate-pulse' },
  connected: { text: 'Online', dot: 'bg-emerald-400' },
  reconnecting: { text: 'Reconnecting', dot: 'bg-amber-400 animate-pulse' },
};

export function RoomInfo({ room, connection, onLeave, leaving }: RoomInfoProps) {
  const [copied, setCopied] = useState<'id' | 'link' | null>(null);
  const conn = connectionLabel[connection];

  const copy = async (kind: 'id' | 'link') => {
    const text = kind === 'id' ? room.id : `${window.location.origin}/room/${room.id}`;
    try {
      await navigator.clipboard.writeText(text);
      setCopied(kind);
      setTimeout(() => setCopied(null), 1500);
    } catch {
      window.prompt('Copy this:', text);
    }
  };

  return (
    <Card className="flex flex-wrap items-center justify-between gap-3 p-4">
      <div className="flex items-center gap-3">
        <div>
          <p className="text-xs tracking-widest text-slate-500 uppercase">Room</p>
          <button
            type="button"
            onClick={() => copy('id')}
            title="Copy room ID"
            className="cursor-pointer font-mono text-2xl font-bold tracking-[0.25em] text-white transition hover:text-indigo-300"
          >
            {room.id}
          </button>
        </div>
        <div className="hidden h-10 w-px bg-slate-800 sm:block" />
        <div className="text-sm text-slate-400">
          <p>Round {room.game.round}</p>
          <p className="flex items-center gap-1.5">
            <span className={cn('size-2 rounded-full', conn.dot)} />
            {conn.text}
          </p>
        </div>
      </div>
      <div className="flex gap-2">
        <Button variant="secondary" size="sm" onClick={() => copy('link')}>
          {copied === 'link' ? 'Copied!' : copied === 'id' ? 'ID copied!' : 'Invite link'}
        </Button>
        <Button variant="danger" size="sm" onClick={onLeave} loading={leaving}>
          Leave
        </Button>
      </div>
    </Card>
  );
}
