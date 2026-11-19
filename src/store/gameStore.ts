import { create } from 'zustand';
import type { ChatMessage, Move, Room } from '@/types/game';

export type ConnectionState = 'idle' | 'connecting' | 'connected' | 'reconnecting';

export type ToastTone = 'info' | 'success' | 'warning' | 'error';

export interface Toast {
  id: number;
  message: string;
  tone: ToastTone;
}

interface GameStore {
  room: Room | null;
  playerId: string | null;
  chat: ChatMessage[];
  connection: ConnectionState;
  /** Fatal error for the room page (room not found, room full, ...). */
  fatalError: string | null;
  toasts: Toast[];

  setJoined: (room: Room, playerId: string, chat: ChatMessage[]) => void;
  setRoom: (room: Room) => void;
  applyMove: (move: Move) => void;
  addChat: (message: ChatMessage) => void;
  setConnection: (state: ConnectionState) => void;
  setFatalError: (message: string | null) => void;
  pushToast: (message: string, tone?: ToastTone) => void;
  dismissToast: (id: number) => void;
  reset: () => void;
}

let toastId = 0;

const initialState = {
  room: null,
  playerId: null,
  chat: [],
  connection: 'idle' as ConnectionState,
  fatalError: null,
  toasts: [],
};

export const useGameStore = create<GameStore>()((set) => ({
  ...initialState,

  setJoined: (room, playerId, chat) => set({ room, playerId, chat, fatalError: null }),

  // Ignore stale snapshots that might arrive out of order.
  setRoom: (room) =>
    set((state) =>
      state.room && state.room.id === room.id && room.updatedAt < state.room.updatedAt
        ? state
        : { room },
    ),

  // Optimistically paint the move so the opponent's stone shows immediately;
  // the authoritative `room-updated` snapshot follows right after.
  applyMove: (move) =>
    set((state) => {
      if (!state.room || state.room.game.board[move.row][move.col] !== null) return state;
      const board = state.room.game.board.map((line) => [...line]);
      board[move.row][move.col] = move.symbol;
      return {
        room: {
          ...state.room,
          game: {
            ...state.room.game,
            board,
            lastMove: move,
            moves: [...state.room.game.moves, move],
            currentTurn: move.symbol === 'X' ? 'O' : 'X',
          },
        },
      };
    }),

  addChat: (message) =>
    set((state) =>
      state.chat.some((m) => m.id === message.id)
        ? state
        : { chat: [...state.chat, message].slice(-200) },
    ),

  setConnection: (connection) => set({ connection }),

  setFatalError: (fatalError) => set({ fatalError }),

  pushToast: (message, tone = 'info') =>
    set((state) => ({ toasts: [...state.toasts, { id: ++toastId, message, tone }].slice(-4) })),

  dismissToast: (id) => set((state) => ({ toasts: state.toasts.filter((t) => t.id !== id) })),

  reset: () => set({ ...initialState, toasts: [] }),
}));
