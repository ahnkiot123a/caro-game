'use client';

import { useEffect } from 'react';
import { getSocket } from '@/lib/socket';
import { socketService } from '@/services/socketService';
import { useGameStore } from '@/store/gameStore';
import type { ServerToClientEvents } from '@/types/socket';

/**
 * Subscribes to all realtime room events and (re)joins the room whenever the socket
 * (re)connects, so a page reload or network drop restores the board automatically.
 */
export function useRoomSocket(roomId: string, nickname: string | null): void {
  useEffect(() => {
    if (!nickname) return;

    const socket = getSocket();
    const store = useGameStore.getState;
    let disposed = false;

    const join = async () => {
      useGameStore.getState().setConnection('connecting');
      const result = await socketService.joinRoom(roomId, nickname);
      if (disposed) return;
      if (!result.ok) {
        store().setFatalError(result.error ?? 'Unable to join the room.');
      } else {
        store().setConnection('connected');
      }
    };

    const isMe = (playerId: string) => store().playerId === playerId;

    const handlers: Partial<ServerToClientEvents> = {
      'room-joined': ({ room, playerId, chat, reconnected }) => {
        if (room.id !== roomId) return;
        store().setJoined(room, playerId, chat);
        if (reconnected && room.game.moves.length > 0) {
          store().pushToast('Reconnected. Board restored.', 'success');
        }
      },
      'room-updated': (room) => {
        if (room.id === roomId) store().setRoom(room);
      },
      'move-made': ({ move }) => store().applyMove(move),
      'chat-message': (message) => {
        if (message.roomId === roomId) store().addChat(message);
      },
      'player-joined': ({ player, reconnected }) => {
        if (isMe(player.id)) return;
        store().pushToast(
          reconnected ? `${player.name} reconnected` : `${player.name} joined the room`,
          'success',
        );
      },
      'player-left': ({ playerId, playerName, reason }) => {
        if (isMe(playerId)) return;
        const text =
          reason === 'disconnected'
            ? `${playerName} disconnected. Holding their seat for 60s…`
            : reason === 'timeout'
              ? `${playerName} did not come back and left the room`
              : `${playerName} left the room`;
        store().pushToast(text, 'warning');
      },
      'game-won': ({ winnerId, winnerName }) => {
        store().pushToast(
          isMe(winnerId) ? 'You won! 🎉' : `${winnerName} won the match`,
          isMe(winnerId) ? 'success' : 'info',
        );
      },
      draw: () => store().pushToast('Draw! The board is full.', 'info'),
      'play-again-request': ({ playerId, playerName }) => {
        if (!isMe(playerId)) store().pushToast(`${playerName} wants a rematch`, 'info');
      },
      'room-error': ({ message }) => {
        store().setFatalError(message);
      },
    };

    const onConnect = () => void join();
    const onDisconnect = () => store().setConnection('reconnecting');

    for (const [event, handler] of Object.entries(handlers)) {
      socket.on(event as keyof ServerToClientEvents, handler as never);
    }
    socket.on('connect', onConnect);
    socket.on('disconnect', onDisconnect);

    if (socket.connected) {
      const state = store();
      if (state.room?.id === roomId && state.playerId) {
        state.setConnection('connected');
      } else {
        void join();
      }
    } else {
      store().setConnection('connecting');
      socket.connect();
    }

    return () => {
      disposed = true;
      for (const [event, handler] of Object.entries(handlers)) {
        socket.off(event as keyof ServerToClientEvents, handler as never);
      }
      socket.off('connect', onConnect);
      socket.off('disconnect', onDisconnect);
    };
  }, [roomId, nickname]);

  useEffect(() => () => useGameStore.getState().reset(), [roomId]);
}
