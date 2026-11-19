'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState, type FormEvent } from 'react';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { useNickname } from '@/hooks/useNickname';
import { MAX_NAME_LENGTH, ROOM_ID_LENGTH } from '@/lib/constants';
import { getSocket } from '@/lib/socket';
import { socketService } from '@/services/socketService';
import { useGameStore } from '@/store/gameStore';
import { isValidRoomId, normalizeRoomId, sanitizeName } from '@/utils/validation';

export function HomeForm() {
  const router = useRouter();
  const { nickname, setNickname, ready } = useNickname();
  const [nameInput, setNameInput] = useState<string | null>(null);
  const [roomInput, setRoomInput] = useState('');
  const [pending, setPending] = useState<'create' | 'join' | null>(null);
  const [openingAi, setOpeningAi] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    router.prefetch('/play/ai');
    getSocket().connect();
  }, [router]);

  const name = nameInput ?? nickname;
  const cleanName = sanitizeName(name);
  const roomId = normalizeRoomId(roomInput);

  const requireName = (): string | null => {
    if (!cleanName) {
      setError('Please enter a nickname first.');
      return null;
    }
    return setNickname(cleanName);
  };

  const handleCreate = async () => {
    setError(null);
    const finalName = requireName();
    if (!finalName) return;
    setPending('create');
    const result = await socketService.createRoom(finalName);
    if (result.ok && result.data) {
      useGameStore.getState().setJoined(result.data.room, result.data.playerId, result.data.chat);
      useGameStore.getState().setConnection('connected');
      router.push(`/room/${result.data.roomId}`);
    } else {
      setError(result.error ?? 'Could not create room.');
      setPending(null);
    }
  };

  const handleJoin = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);
    const finalName = requireName();
    if (!finalName) return;
    if (!isValidRoomId(roomId)) {
      setError(`Room ID must be ${ROOM_ID_LENGTH} characters.`);
      return;
    }
    setPending('join');
    const result = await socketService.joinRoom(roomId, finalName);
    if (result.ok) {
      router.push(`/room/${roomId}`);
    } else {
      setError(result.error ?? 'Could not join room.');
      setPending(null);
    }
  };

  return (
    <Card className="w-full max-w-md p-6 sm:p-8">
      <div className="space-y-6">
        <div className="space-y-2">
          <label htmlFor="nickname" className="text-sm font-medium text-slate-300">
            Nickname
          </label>
          <Input
            id="nickname"
            autoComplete="nickname"
            placeholder={ready ? 'e.g. GomokuMaster' : 'Loading…'}
            maxLength={MAX_NAME_LENGTH}
            value={name}
            onChange={(e) => setNameInput(e.target.value)}
          />
        </div>

        <Button
          size="lg"
          className="w-full"
          onClick={handleCreate}
          loading={pending === 'create'}
          disabled={pending !== null}
        >
          Create Room
        </Button>

        <div className="flex items-center gap-3 text-xs tracking-widest text-slate-500 uppercase">
          <span className="h-px flex-1 bg-slate-800" />
          or join a friend
          <span className="h-px flex-1 bg-slate-800" />
        </div>

        <form onSubmit={handleJoin} className="flex gap-2">
          <Input
            aria-label="Room ID"
            placeholder="ROOM ID"
            value={roomInput}
            maxLength={ROOM_ID_LENGTH + 4}
            onChange={(e) => setRoomInput(e.target.value.toUpperCase())}
            className="font-mono tracking-[0.3em] uppercase"
          />
          <Button
            type="submit"
            variant="secondary"
            size="lg"
            loading={pending === 'join'}
            disabled={pending !== null}
          >
            Join
          </Button>
        </form>

        <Button
          variant="ghost"
          className="w-full border border-dashed border-slate-700"
          onClick={() => {
            setOpeningAi(true);
            router.push('/play/ai');
          }}
          loading={openingAi}
          disabled={pending !== null || openingAi}
        >
          {openingAi ? 'Opening game…' : '🤖 Play vs Computer'}
        </Button>

        {error && (
          <p role="alert" className="rounded-lg bg-rose-500/10 px-3 py-2 text-sm text-rose-300">
            {error}
          </p>
        )}
      </div>
    </Card>
  );
}
