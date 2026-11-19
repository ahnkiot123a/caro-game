import type { Board, PlayerSymbol } from '@/types/game';
import { findBestMove, type AiMove } from '@/utils/caroAI';

export interface AiWorkerRequest {
  id: number;
  board: Board;
  symbol: PlayerSymbol;
}

export interface AiWorkerResponse {
  id: number;
  move: AiMove | null;
}

// Runs the search off the main thread so the UI stays responsive while the computer thinks.
self.onmessage = (event: MessageEvent<AiWorkerRequest>) => {
  const { id, board, symbol } = event.data;
  const response: AiWorkerResponse = { id, move: findBestMove(board, symbol) };
  self.postMessage(response);
};
