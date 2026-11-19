import { WIN_LENGTH } from '@/lib/constants';
import type { Board, PlayerSymbol } from '@/types/game';

export interface AiMove {
  row: number;
  col: number;
}

export interface AiOptions {
  /** Search stops after this budget and plays the best move of the last completed depth. */
  timeLimitMs?: number;
  maxDepth?: number;
  /** Candidate moves examined at each inner node (after move ordering). */
  breadth?: number;
  rootBreadth?: number;
}

type Color = 1 | 2;

const WIN_SCORE = 1_000_000_000;
/** Value of a 5-cell window holding N stones of one color and none of the other. */
const WEIGHTS = [0, 1, 12, 150, 3_000, WIN_SCORE];
const DEFENSE_FACTOR = 0.9;
const NEIGHBOR_RADIUS = 2;
const DIRECTIONS = [
  [0, 1],
  [1, 0],
  [1, 1],
  [1, -1],
] as const;

const TIMEOUT = Symbol('ai-timeout');

interface Geometry {
  n: number;
  /** cellWindows[cell] = ids of every 5-cell window that contains the cell. */
  cellWindows: number[][];
  windowCount: number;
  neighbors: number[][];
}

const geometryCache = new Map<number, Geometry>();

function getGeometry(n: number): Geometry {
  const cached = geometryCache.get(n);
  if (cached) return cached;

  const cellWindows: number[][] = Array.from({ length: n * n }, () => []);
  let windowCount = 0;
  for (let r = 0; r < n; r++) {
    for (let c = 0; c < n; c++) {
      for (const [dr, dc] of DIRECTIONS) {
        const endR = r + dr * (WIN_LENGTH - 1);
        const endC = c + dc * (WIN_LENGTH - 1);
        if (endR < 0 || endR >= n || endC < 0 || endC >= n) continue;
        const id = windowCount++;
        for (let k = 0; k < WIN_LENGTH; k++) cellWindows[(r + dr * k) * n + c + dc * k].push(id);
      }
    }
  }

  const neighbors: number[][] = Array.from({ length: n * n }, (_, idx) => {
    const r = Math.floor(idx / n);
    const c = idx % n;
    const list: number[] = [];
    for (let dr = -NEIGHBOR_RADIUS; dr <= NEIGHBOR_RADIUS; dr++) {
      for (let dc = -NEIGHBOR_RADIUS; dc <= NEIGHBOR_RADIUS; dc++) {
        const rr = r + dr;
        const cc = c + dc;
        if ((dr || dc) && rr >= 0 && rr < n && cc >= 0 && cc < n) list.push(rr * n + cc);
      }
    }
    return list;
  });

  const geometry = { n, cellWindows, windowCount, neighbors };
  geometryCache.set(n, geometry);
  return geometry;
}

const now = () => (typeof performance !== 'undefined' ? performance.now() : Date.now());

/**
 * Board evaluation is kept incrementally: every 5-cell window tracks how many
 * X and O stones it holds, so placing/removing a stone only touches the ~20
 * windows through that cell and static evaluation is O(1).
 */
class Searcher {
  private readonly cells: Int8Array;
  private readonly counts: [Int8Array, Int8Array, Int8Array];
  private readonly score = [0, 0, 0];
  /** Windows with 4 stones of a color and none of the other (= a winning threat). */
  private readonly fours = [0, 0, 0];
  private stones = 0;
  private deadline = Infinity;
  private nodes = 0;

  constructor(
    private readonly geo: Geometry,
    board: Board,
  ) {
    this.cells = new Int8Array(geo.n * geo.n);
    this.counts = [
      new Int8Array(0),
      new Int8Array(geo.windowCount),
      new Int8Array(geo.windowCount),
    ];
    board.forEach((line, r) =>
      line.forEach((value, c) => {
        if (value) this.place(r * geo.n + c, value === 'X' ? 1 : 2);
      }),
    );
  }

  /** Places a stone and returns true when it completes five in a row. */
  private place(idx: number, me: Color): boolean {
    const opp = (3 - me) as Color;
    const mine = this.counts[me];
    const theirs = this.counts[opp];
    let won = false;
    this.cells[idx] = me;
    this.stones++;

    for (const w of this.geo.cellWindows[idx]) {
      const mc = mine[w];
      const oc = theirs[w];
      if (oc === 0) {
        this.score[me] += WEIGHTS[mc + 1] - WEIGHTS[mc];
        if (mc === 4) this.fours[me]--;
        if (mc + 1 === 4) this.fours[me]++;
        if (mc + 1 >= WIN_LENGTH) won = true;
      } else if (mc === 0) {
        // The window is now blocked for the opponent.
        this.score[opp] -= WEIGHTS[oc];
        if (oc === 4) this.fours[opp]--;
      }
      mine[w] = mc + 1;
    }
    return won;
  }

  private undo(idx: number, me: Color): void {
    const opp = (3 - me) as Color;
    const mine = this.counts[me];
    const theirs = this.counts[opp];
    this.cells[idx] = 0;
    this.stones--;

    for (const w of this.geo.cellWindows[idx]) {
      const mc = mine[w] - 1;
      const oc = theirs[w];
      mine[w] = mc;
      if (oc === 0) {
        this.score[me] -= WEIGHTS[mc + 1] - WEIGHTS[mc];
        if (mc + 1 === 4) this.fours[me]--;
        if (mc === 4) this.fours[me]++;
      } else if (mc === 0) {
        this.score[opp] += WEIGHTS[oc];
        if (oc === 4) this.fours[opp]++;
      }
    }
  }

  /** Static evaluation from the point of view of `me`, who is about to move. */
  private evaluate(me: Color): number {
    if (this.fours[me] > 0) return WIN_SCORE / 2;
    return this.score[me] - this.score[3 - me];
  }

  /**
   * Candidate moves near existing stones, best first. Immediate wins and forced
   * blocks short-circuit the list, which keeps the search tactically sharp.
   */
  private generate(me: Color, limit: number): number[] {
    const { n, cellWindows, neighbors } = this.geo;
    if (this.stones === 0) return [(n >> 1) * n + (n >> 1)];

    const mine = this.counts[me];
    const theirs = this.counts[3 - me];
    const scored: { idx: number; value: number }[] = [];
    const blocks: number[] = [];

    for (let idx = 0; idx < n * n; idx++) {
      if (this.cells[idx] !== 0) continue;
      if (!neighbors[idx].some((j) => this.cells[j] !== 0)) continue;

      let attack = 0;
      let defense = 0;
      let mustBlock = false;
      for (const w of cellWindows[idx]) {
        const mc = mine[w];
        const oc = theirs[w];
        if (oc === 0) {
          if (mc === 4) return [idx];
          attack += WEIGHTS[mc + 1] - WEIGHTS[mc];
        } else if (mc === 0) {
          if (oc === 4) mustBlock = true;
          defense += WEIGHTS[oc];
        }
      }
      if (mustBlock) blocks.push(idx);
      scored.push({ idx, value: attack + defense * DEFENSE_FACTOR });
    }

    if (blocks.length > 0) return blocks;
    scored.sort((a, b) => b.value - a.value);
    return scored.slice(0, limit).map((s) => s.idx);
  }

  private negamax(depth: number, alpha: number, beta: number, me: Color, breadth: number): number {
    if ((++this.nodes & 1023) === 0 && now() > this.deadline) throw TIMEOUT;
    if (depth === 0) return this.evaluate(me);

    const moves = this.generate(me, breadth);
    if (moves.length === 0) return 0;

    const opp = (3 - me) as Color;
    let best = -Infinity;
    for (const idx of moves) {
      const won = this.place(idx, me);
      // Prefer quicker wins / slower losses via the remaining depth.
      const value = won ? WIN_SCORE + depth : -this.negamax(depth - 1, -beta, -alpha, opp, breadth);
      this.undo(idx, me);
      if (value > best) best = value;
      if (best > alpha) alpha = best;
      if (alpha >= beta) break;
    }
    return best;
  }

  search(me: Color, options: Required<AiOptions>): number {
    let rootMoves = this.generate(me, options.rootBreadth);
    if (rootMoves.length <= 1) return rootMoves[0] ?? -1;

    const start = now();
    this.deadline = start + options.timeLimitMs;
    const opp = (3 - me) as Color;
    let best = rootMoves[0];

    for (let depth = 2; depth <= options.maxDepth; depth += 2) {
      try {
        let alpha = -Infinity;
        let iterBest = rootMoves[0];
        let iterScore = -Infinity;
        for (const idx of rootMoves) {
          const won = this.place(idx, me);
          const value = won
            ? WIN_SCORE + depth
            : -this.negamax(depth - 1, -Infinity, -alpha, opp, options.breadth);
          this.undo(idx, me);
          if (value > iterScore) {
            iterScore = value;
            iterBest = idx;
          }
          if (value > alpha) alpha = value;
        }
        best = iterBest;
        // Search the previous best first next iteration for better pruning.
        rootMoves = [best, ...rootMoves.filter((m) => m !== best)];
        if (Math.abs(iterScore) >= WIN_SCORE / 2) break;
        // A deeper iteration costs several times more; don't start one we can't finish.
        if (now() - start > options.timeLimitMs * 0.3) break;
      } catch (error) {
        // A timed-out iteration leaves the board mid-search, but this searcher is discarded.
        if (error === TIMEOUT) break;
        throw error;
      }
    }
    return best;
  }
}

const DEFAULT_OPTIONS: Required<AiOptions> = {
  timeLimitMs: 900,
  maxDepth: 8,
  breadth: 10,
  rootBreadth: 16,
};

/**
 * Hard computer opponent: iterative-deepening negamax with alpha-beta pruning,
 * threat-aware move ordering and forced win/block detection.
 * Returns null when the board has no empty cell.
 */
export function findBestMove(
  board: Board,
  symbol: PlayerSymbol,
  options: AiOptions = {},
): AiMove | null {
  const n = board.length;
  const searcher = new Searcher(getGeometry(n), board);
  const idx = searcher.search(symbol === 'X' ? 1 : 2, { ...DEFAULT_OPTIONS, ...options });
  return idx < 0 ? null : { row: Math.floor(idx / n), col: idx % n };
}
