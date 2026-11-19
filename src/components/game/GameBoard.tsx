'use client';

import { useCallback, useRef, useState } from 'react';
import { socketService } from '@/services/socketService';
import { useGameStore } from '@/store/gameStore';
import type { Room } from '@/types/game';
import { getRoomStatus } from '@/utils/roomStatus';
import { Board } from './Board';

interface GameBoardProps {
  room: Room;
  playerId: string;
}

export function GameBoard({ room, playerId }: GameBoardProps) {
  const pushToast = useGameStore((s) => s.pushToast);
  const [pending, setPending] = useState(false);
  const pendingRef = useRef(false);
  const { game } = room;
  const status = getRoomStatus(room, playerId);
  const myTurn = status.kind === 'your-turn';

  const handlePlay = useCallback(
    async (row: number, col: number) => {
      if (pendingRef.current) return;
      pendingRef.current = true;
      setPending(true);
      const result = await socketService.move(room.id, row, col);
      pendingRef.current = false;
      setPending(false);
      if (!result.ok) pushToast(result.error ?? 'Move rejected.', 'error');
    },
    [room.id, pushToast],
  );

  return (
    <Board
      board={game.board}
      lastMove={game.lastMove}
      winningLine={game.winningLine}
      disabled={!myTurn || pending}
      hoverSymbol={status.me?.symbol ?? null}
      finished={game.status === 'finished'}
      onPlay={handlePlay}
    />
  );
}
