/** Sliding tile puzzle: one empty cell; tiles slide orthogonally into it. */

export function indexToRC(i: number, n: number): { r: number; c: number } {
  return { r: Math.floor(i / n), c: i % n };
}

export function rcToIndex(r: number, c: number, n: number): number {
  return r * n + c;
}

/** Solved: slot i holds piece i; last slot holds empty (-1). Pieces are 0..n*n-2 */
export function createSolved(n: number): number[] {
  const size = n * n;
  const b = Array.from({ length: size }, (_, i) => i);
  b[size - 1] = -1;
  return b;
}

export function getEmptyIndex(board: number[]): number {
  const i = board.indexOf(-1);
  if (i < 0) throw new Error("no empty cell");
  return i;
}

export function isSolved(board: number[], n: number): boolean {
  const size = n * n;
  for (let i = 0; i < size; i++) {
    const want = i === size - 1 ? -1 : i;
    if (board[i] !== want) return false;
  }
  return true;
}

function canMove(emptyIdx: number, tapIdx: number, n: number): boolean {
  const a = indexToRC(emptyIdx, n);
  const b = indexToRC(tapIdx, n);
  return Math.abs(a.r - b.r) + Math.abs(a.c - b.c) === 1;
}

/** Swap empty with tapped adjacent tile; returns new board or null */
export function tryMove(
  board: number[],
  n: number,
  tapIdx: number
): number[] | null {
  const e = getEmptyIndex(board);
  if (tapIdx === e || tapIdx < 0 || tapIdx >= n * n) return null;
  if (!canMove(e, tapIdx, n)) return null;
  const next = [...board];
  next[e] = next[tapIdx];
  next[tapIdx] = -1;
  return next;
}

/** Random valid moves from current state */
export function shuffleBoard(n: number, randomMoves = 280): number[] {
  let b = createSolved(n);
  let empty = n * n - 1;
  const size = n * n;
  for (let m = 0; m < randomMoves; m++) {
    const { r, c } = indexToRC(empty, n);
    const opts: number[] = [];
    if (r > 0) opts.push(rcToIndex(r - 1, c, n));
    if (r < n - 1) opts.push(rcToIndex(r + 1, c, n));
    if (c > 0) opts.push(rcToIndex(r, c - 1, n));
    if (c < n - 1) opts.push(rcToIndex(r, c + 1, n));
    const pick = opts[Math.floor(Math.random() * opts.length)];
    const next = tryMove(b, n, pick);
    if (next) {
      b = next;
      empty = getEmptyIndex(b);
    }
  }
  return b;
}
