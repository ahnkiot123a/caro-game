'use client';

import { useCallback, useEffect, useReducer, useRef } from 'react';
import { BOARD_SIZE } from '@/lib/constants';
import type { Board, BoardCell, Move, PlayerSymbol } from '@/types/game';
import type { AiWorkerRequest, AiWorkerResponse } from '@/workers/caroAI.worker';
import { findBestMove, type AiMove } from '@/utils/caroAI';
import { checkWinner, createEmptyBoard } from '@/utils/checkWinner';

/** Minimum time the computer "thinks", so its stone doesn't appear jarringly fast. */
const MIN_THINK_MS = 200;

export const HUMAN_ID = 'human';
export const AI_ID = 'computer';

export type AiOutcome = 'human' | 'ai' | 'draw';

export interface AiGameState {
  phase: 'setup' | 'playing' | 'finished';
  humanSymbol: PlayerSymbol;
  board: Board;
  currentTurn: PlayerSymbol;
  lastMove: Move | null;
  moveCount: number;
  winningLine: BoardCell[] | null;
  outcome: AiOutcome | null;
  /** Increments every game so late AI replies from a previous game are ignored. */
  gameId: number;
  stats: { wins: number; losses: number; draws: number };
}

type Action =
  | { type: 'start'; humanFirst: boolean }
  | { type: 'move'; actor: 'human' | 'ai'; row: number; col: number; gameId?: number }
  | { type: 'setup' };

const initialState: AiGameState = {
  phase: 'setup',
  humanSymbol: 'X',
  board: createEmptyBoard(),
  currentTurn: 'X',
  lastMove: null,
  moveCount: 0,
  winningLine: null,
  outcome: null,
  gameId: 0,
  stats: { wins: 0, losses: 0, draws: 0 },
};

function reducer(state: AiGameState, action: Action): AiGameState {
  switch (action.type) {
    case 'setup':
      return { ...state, phase: 'setup', gameId: state.gameId + 1 };
    case 'start':
      return {
        ...state,
        phase: 'playing',
        humanSymbol: action.humanFirst ? 'X' : 'O',
        board: createEmptyBoard(),
        currentTurn: 'X',
        lastMove: null,
        moveCount: 0,
        winningLine: null,
        outcome: null,
        gameId: state.gameId + 1,
      };
    case 'move': {
      const { row, col, actor } = action;
      const symbol = actor === 'human' ? state.humanSymbol : state.humanSymbol === 'X' ? 'O' : 'X';
      if (
        state.phase !== 'playing' ||
        (action.gameId !== undefined && action.gameId !== state.gameId) ||
        state.currentTurn !== symbol ||
        state.board[row]?.[col] !== null
      ) {
        return state;
      }

      const board = state.board.map((line) => [...line]);
      board[row][col] = symbol;
      const moveCount = state.moveCount + 1;
      const lastMove: Move = {
        row,
        col,
        symbol,
        playerId: actor === 'human' ? HUMAN_ID : AI_ID,
        moveNumber: moveCount,
        timestamp: Date.now(),
      };
      const winningLine = checkWinner(board, row, col);
      const outcome: AiOutcome | null = winningLine
        ? actor
        : moveCount >= BOARD_SIZE * BOARD_SIZE
          ? 'draw'
          : null;

      if (!outcome) {
        return { ...state, board, lastMove, moveCount, currentTurn: symbol === 'X' ? 'O' : 'X' };
      }
      const { wins, losses, draws } = state.stats;
      return {
        ...state,
        board,
        lastMove,
        moveCount,
        winningLine,
        outcome,
        phase: 'finished',
        stats: {
          wins: wins + (outcome === 'human' ? 1 : 0),
          losses: losses + (outcome === 'ai' ? 1 : 0),
          draws: draws + (outcome === 'draw' ? 1 : 0),
        },
      };
    }
  }
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/** Local single-player game against the computer. No server or socket involved. */
export function useAiGame() {
  const [state, dispatch] = useReducer(reducer, initialState);
  const workerRef = useRef<Worker | null>(null);
  const requestId = useRef(0);

  useEffect(() => {
    try {
      workerRef.current = new Worker(new URL('../workers/caroAI.worker.ts', import.meta.url));
    } catch {
      workerRef.current = null;
    }
    return () => {
      workerRef.current?.terminate();
      workerRef.current = null;
    };
  }, []);

  const computeMove = useCallback((board: Board, symbol: PlayerSymbol): Promise<AiMove | null> => {
    const worker = workerRef.current;
    // Fallback for environments without Web Workers.
    if (!worker) return Promise.resolve(findBestMove(board, symbol));

    const id = ++requestId.current;
    return new Promise((resolve) => {
      const onMessage = (event: MessageEvent<AiWorkerResponse>) => {
        if (event.data.id !== id) return;
        worker.removeEventListener('message', onMessage);
        resolve(event.data.move);
      };
      worker.addEventListener('message', onMessage);
      worker.postMessage({ id, board, symbol } satisfies AiWorkerRequest);
    });
  }, []);

  const aiSymbol: PlayerSymbol = state.humanSymbol === 'X' ? 'O' : 'X';
  const thinking = state.phase === 'playing' && state.currentTurn === aiSymbol;

  useEffect(() => {
    if (!thinking) return;
    let cancelled = false;
    const startedAt = Date.now();
    const { gameId, board } = state;

    void computeMove(board, aiSymbol).then(async (move) => {
      await sleep(Math.max(0, MIN_THINK_MS - (Date.now() - startedAt)));
      if (!cancelled && move) dispatch({ type: 'move', actor: 'ai', ...move, gameId });
    });

    return () => {
      cancelled = true;
    };
    // Re-run only when it becomes the computer's turn in a (new) position.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [thinking, state.board, state.gameId, aiSymbol, computeMove]);

  const play = useCallback(
    (row: number, col: number) => dispatch({ type: 'move', actor: 'human', row, col }),
    [],
  );
  const start = useCallback((humanFirst: boolean) => dispatch({ type: 'start', humanFirst }), []);
  const backToSetup = useCallback(() => dispatch({ type: 'setup' }), []);

  return { state, thinking, aiSymbol, play, start, backToSetup };
}
