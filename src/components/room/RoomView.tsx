'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { GameBoard } from '@/components/game/GameBoard';
import { ResultModal } from '@/components/game/ResultModal';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { useNickname } from '@/hooks/useNickname';
import { useRoomSocket } from '@/hooks/useRoomSocket';
import { socketService } from '@/services/socketService';
import { useGameStore } from '@/store/gameStore';
import { ChatPanel } from './ChatPanel';
import { NicknameGate } from './NicknameGate';
import { PlayerList } from './PlayerList';
import { RoomInfo } from './RoomInfo';
import { RoomStatusBanner } from './RoomStatusBanner';

export function RoomView({ roomId }: { roomId: string }) {
  const router = useRouter();
  const { nickname, setNickname, ready } = useNickname();
  const room = useGameStore((s) => s.room);
  const playerId = useGameStore((s) => s.playerId);
  const connection = useGameStore((s) => s.connection);
  const fatalError = useGameStore((s) => s.fatalError);
  const [leaving, setLeaving] = useState(false);

  useRoomSocket(roomId, ready && nickname ? nickname : null);

  const leave = async () => {
    setLeaving(true);
    await socketService.leaveRoom(roomId);
    router.push('/');
  };

  if (!ready) return <LoadingState />;
  if (!nickname) return <NicknameGate roomId={roomId} onSubmit={setNickname} />;

  if (fatalError) {
    return (
      <Card className="mx-auto w-full max-w-md p-6 text-center">
        <div className="mb-2 text-4xl">🚫</div>
        <h1 className="text-xl font-bold text-white">Can&apos;t enter room {roomId}</h1>
        <p className="mt-2 text-sm text-slate-400">{fatalError}</p>
        <Button className="mt-5" onClick={() => router.push('/')}>
          Back to home
        </Button>
      </Card>
    );
  }

  if (!room || !playerId) return <LoadingState />;

  return (
    <div className="grid w-full gap-4 xl:grid-cols-[minmax(0,1fr)_260px]">
      <div className="space-y-4">
        <RoomInfo room={room} connection={connection} onLeave={leave} leaving={leaving} />
        <RoomStatusBanner room={room} playerId={playerId} />
        <GameBoard room={room} playerId={playerId} />
      </div>
      <aside className="flex flex-col gap-4 xl:sticky xl:top-6 xl:max-h-[calc(100dvh-7rem)]">
        <PlayerList room={room} playerId={playerId} />
        <ChatPanel roomId={room.id} playerId={playerId} className="h-[420px] xl:h-auto xl:flex-1" />
      </aside>
      <ResultModal room={room} playerId={playerId} />
    </div>
  );
}

function LoadingState() {
  return (
    <div className="flex flex-col items-center gap-3 py-24 text-slate-400">
      <span className="size-8 animate-spin rounded-full border-2 border-indigo-400 border-t-transparent" />
      Connecting to room…
    </div>
  );
}
