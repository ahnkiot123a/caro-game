import type { Player, Room } from '@/types/game';

export type RoomStatusKind =
  'connecting' | 'waiting' | 'your-turn' | 'opponent-turn' | 'opponent-disconnected' | 'finished';

export interface RoomStatusInfo {
  kind: RoomStatusKind;
  label: string;
  me: Player | null;
  opponent: Player | null;
}

export function getRoomStatus(room: Room | null, playerId: string | null): RoomStatusInfo {
  const me = room?.players.find((p) => p.id === playerId) ?? null;
  const opponent = room?.players.find((p) => p.id !== playerId) ?? null;

  if (!room || !me) return { kind: 'connecting', label: 'Connecting…', me, opponent };
  if (room.game.status === 'finished')
    return { kind: 'finished', label: 'Match finished', me, opponent };
  if (opponent && !opponent.connected) {
    return { kind: 'opponent-disconnected', label: 'Opponent disconnected', me, opponent };
  }
  if (!opponent || room.game.status === 'waiting') {
    return { kind: 'waiting', label: 'Waiting for player', me, opponent };
  }
  return room.game.currentTurn === me.symbol
    ? { kind: 'your-turn', label: 'Your turn', me, opponent }
    : { kind: 'opponent-turn', label: 'Opponent turn', me, opponent };
}
