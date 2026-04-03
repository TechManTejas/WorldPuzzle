export const ROWS = 6;
export const COLS = 6;
const NUM_GEM_TYPES = 4;

export type Tile = { gem: number; id: string };
export type Board = Tile[][];

let tileIdSeq = 0;
export function newTileId(): string {
  tileIdSeq += 1;
  return `g${tileIdSeq}`;
}

function randomGemType(): number {
  return Math.floor(Math.random() * NUM_GEM_TYPES);
}

function emptyCell(): Tile {
  return { gem: -1, id: "" };
}

function wouldCreateMatch(
  board: Board,
  r: number,
  c: number,
  gem: number
): boolean {
  if (c >= 2) {
    const g1 = board[r][c - 1].gem;
    const g2 = board[r][c - 2].gem;
    if (g1 === gem && g2 === gem) return true;
  }
  if (r >= 2) {
    const g1 = board[r - 1][c].gem;
    const g2 = board[r - 2][c].gem;
    if (g1 === gem && g2 === gem) return true;
  }
  return false;
}

export function createBoard(): Board {
  const board: Board = Array.from({ length: ROWS }, () =>
    Array.from({ length: COLS }, () => ({ gem: 0, id: "" }))
  );
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      let gem: number;
      let tries = 0;
      do {
        gem = randomGemType();
        tries++;
      } while (tries < 40 && wouldCreateMatch(board, r, c, gem));
      board[r][c] = { gem, id: newTileId() };
    }
  }
  return board;
}

export function key(r: number, c: number): string {
  return `${r},${c}`;
}

export function findMatches(board: Board): Set<string> {
  const matched = new Set<string>();

  for (let r = 0; r < ROWS; r++) {
    let c = 0;
    while (c < COLS) {
      let len = 1;
      const g0 = board[r][c].gem;
      while (
        c + len < COLS &&
        board[r][c + len].gem !== -1 &&
        board[r][c + len].gem === g0
      ) {
        len++;
      }
      if (len >= 3 && g0 !== -1) {
        for (let k = 0; k < len; k++) matched.add(key(r, c + k));
      }
      c += len;
    }
  }

  for (let c = 0; c < COLS; c++) {
    let r = 0;
    while (r < ROWS) {
      let len = 1;
      const g0 = board[r][c].gem;
      while (
        r + len < ROWS &&
        board[r + len][c].gem !== -1 &&
        board[r + len][c].gem === g0
      ) {
        len++;
      }
      if (len >= 3 && g0 !== -1) {
        for (let k = 0; k < len; k++) matched.add(key(r + k, c));
      }
      r += len;
    }
  }

  return matched;
}

function refillColumn(board: Board, c: number): void {
  const surv: Tile[] = [];
  for (let r = 0; r < ROWS; r++) {
    if (board[r][c].gem !== -1) surv.push(board[r][c]);
  }
  const missing = ROWS - surv.length;
  for (let r = 0; r < missing; r++) {
    board[r][c] = { gem: randomGemType(), id: newTileId() };
  }
  for (let r = 0; r < surv.length; r++) {
    board[missing + r][c] = surv[r];
  }
}

export function clearAndDrop(board: Board, matched: Set<string>): void {
  for (const k of matched) {
    const [rs, cs] = k.split(",").map(Number);
    board[rs][cs] = emptyCell();
  }
  for (let c = 0; c < COLS; c++) {
    refillColumn(board, c);
  }
}

export function cloneBoard(board: Board): Board {
  return board.map((row) => row.map((t) => ({ gem: t.gem, id: t.id })));
}

export function swapCells(
  board: Board,
  r1: number,
  c1: number,
  r2: number,
  c2: number
): void {
  const t = board[r1][c1];
  board[r1][c1] = board[r2][c2];
  board[r2][c2] = t;
}

export function isAdjacent(
  r1: number,
  c1: number,
  r2: number,
  c2: number
): boolean {
  const dr = Math.abs(r1 - r2);
  const dc = Math.abs(c1 - c2);
  return dr + dc === 1;
}

/** Swap adjacent cells; keep swap only if it creates at least one match. */
export function swapIfMatch(
  board: Board,
  r1: number,
  c1: number,
  r2: number,
  c2: number
): boolean {
  if (!isAdjacent(r1, c1, r2, c2)) return false;
  swapCells(board, r1, c1, r2, c2);
  if (findMatches(board).size === 0) {
    swapCells(board, r1, c1, r2, c2);
    return false;
  }
  return true;
}

/** One clear-and-drop cycle. Returns null when the board has no matches. */
export function resolveOneMatchStep(board: Board): {
  scoreDelta: number;
  clearedCount: number;
} | null {
  const m = findMatches(board);
  if (m.size === 0) return null;
  const clearedCount = m.size;
  const scoreDelta = clearedCount * 12;
  clearAndDrop(board, m);
  return { scoreDelta, clearedCount };
}

export function applyHammerClear(board: Board, r: number, c: number): boolean {
  if (board[r][c].gem === -1) return false;
  clearAndDrop(board, new Set<string>([key(r, c)]));
  return true;
}

/** Clears a full row of gems; returns cells cleared, or null if row empty. */
export function applyRowBlastClear(
  board: Board,
  row: number
): { cleared: number } | null {
  const matched = new Set<string>();
  for (let c = 0; c < COLS; c++) {
    if (board[row][c].gem !== -1) matched.add(key(row, c));
  }
  if (matched.size === 0) return null;
  const cleared = matched.size;
  clearAndDrop(board, matched);
  return { cleared };
}
