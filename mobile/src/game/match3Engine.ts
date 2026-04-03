export const ROWS = 6;
export const COLS = 6;
const NUM_GEM_TYPES = 4;

export type SpecialKind = "coin" | "crown";

export type Tile = {
  gem: number;
  id: string;
  special: SpecialKind | null;
};

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
  return { gem: -1, id: "", special: null };
}

function isNormal(t: Tile): boolean {
  return t.gem >= 0 && t.special === null;
}

function wouldCreateMatch(
  board: Board,
  r: number,
  c: number,
  gem: number
): boolean {
  if (c >= 2) {
    const a = board[r][c - 1];
    const b = board[r][c - 2];
    if (isNormal(a) && isNormal(b) && a.gem === gem && b.gem === gem) return true;
  }
  if (r >= 2) {
    const a = board[r - 1][c];
    const b = board[r - 2][c];
    if (isNormal(a) && isNormal(b) && a.gem === gem && b.gem === gem) return true;
  }
  return false;
}

export function createBoard(): Board {
  const board: Board = Array.from({ length: ROWS }, () =>
    Array.from({ length: COLS }, () => ({ gem: 0, id: "", special: null }))
  );
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      let gem: number;
      let tries = 0;
      do {
        gem = randomGemType();
        tries++;
      } while (tries < 40 && wouldCreateMatch(board, r, c, gem));
      board[r][c] = { gem, id: newTileId(), special: null };
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
      if (!isNormal(board[r][c])) {
        c++;
        continue;
      }
      let len = 1;
      const g0 = board[r][c].gem;
      while (
        c + len < COLS &&
        isNormal(board[r][c + len]) &&
        board[r][c + len].gem === g0
      ) {
        len++;
      }
      if (len >= 3) {
        for (let k = 0; k < len; k++) matched.add(key(r, c + k));
      }
      c += len;
    }
  }

  for (let c = 0; c < COLS; c++) {
    let r = 0;
    while (r < ROWS) {
      if (!isNormal(board[r][c])) {
        r++;
        continue;
      }
      let len = 1;
      const g0 = board[r][c].gem;
      while (
        r + len < ROWS &&
        isNormal(board[r + len][c]) &&
        board[r + len][c].gem === g0
      ) {
        len++;
      }
      if (len >= 3) {
        for (let k = 0; k < len; k++) matched.add(key(r + k, c));
      }
      r += len;
    }
  }

  return matched;
}

/** Horizontal/vertical segments of 4+ → coin; 5+ → crown (crown wins that cell). */
function planSpecialSpawns(board: Board, matched: Set<string>): {
  crown: Set<string>;
  coin: Set<string>;
} {
  const crown = new Set<string>();
  const coin = new Set<string>();

  const inM = (r: number, c: number) => matched.has(key(r, c));

  for (let r = 0; r < ROWS; r++) {
    let c = 0;
    while (c < COLS) {
      if (!inM(r, c) || !isNormal(board[r][c])) {
        c++;
        continue;
      }
      let len = 1;
      const g0 = board[r][c].gem;
      while (
        c + len < COLS &&
        inM(r, c + len) &&
        isNormal(board[r][c + len]) &&
        board[r][c + len].gem === g0
      ) {
        len++;
      }
      if (len >= 5) {
        const mid = c + Math.floor((len - 1) / 2);
        crown.add(key(r, mid));
      } else if (len >= 4) {
        const mid = c + Math.floor((len - 1) / 2);
        coin.add(key(r, mid));
      }
      c += len;
    }
  }

  for (let c = 0; c < COLS; c++) {
    let r = 0;
    while (r < ROWS) {
      if (!inM(r, c) || !isNormal(board[r][c])) {
        r++;
        continue;
      }
      let len = 1;
      const g0 = board[r][c].gem;
      while (
        r + len < ROWS &&
        inM(r + len, c) &&
        isNormal(board[r + len][c]) &&
        board[r + len][c].gem === g0
      ) {
        len++;
      }
      if (len >= 5) {
        const midR = r + Math.floor((len - 1) / 2);
        crown.add(key(midR, c));
      } else if (len >= 4) {
        const midR = r + Math.floor((len - 1) / 2);
        coin.add(key(midR, c));
      }
      r += len;
    }
  }

  for (const k of crown) coin.delete(k);

  return { crown, coin };
}

function refillColumn(board: Board, c: number): void {
  const surv: Tile[] = [];
  for (let r = 0; r < ROWS; r++) {
    if (board[r][c].gem !== -1) surv.push(board[r][c]);
  }
  const missing = ROWS - surv.length;
  for (let r = 0; r < missing; r++) {
    board[r][c] = {
      gem: randomGemType(),
      id: newTileId(),
      special: null,
    };
  }
  for (let r = 0; r < surv.length; r++) {
    board[missing + r][c] = surv[r];
  }
}

export function clearAndDrop(board: Board, matched: Set<string>): void {
  const { crown, coin } = planSpecialSpawns(board, matched);

  for (const k of matched) {
    const [rs, cs] = k.split(",").map(Number);
    if (crown.has(k)) {
      board[rs][cs] = {
        gem: 0,
        id: newTileId(),
        special: "crown",
      };
    } else if (coin.has(k)) {
      board[rs][cs] = {
        gem: 0,
        id: newTileId(),
        special: "coin",
      };
    } else {
      board[rs][cs] = emptyCell();
    }
  }
  for (let c = 0; c < COLS; c++) {
    refillColumn(board, c);
  }
}

export function cloneBoard(board: Board): Board {
  return board.map((row) =>
    row.map((t) => ({
      gem: t.gem,
      id: t.id,
      special: t.special,
    }))
  );
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

/** Swap adjacent cells; keep swap only if it creates at least one match (normal gems only). */
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

/** Clears an entire row (coin activation). Returns tiles cleared. */
export function applyCoinRowBlast(board: Board, row: number): number {
  const matched = new Set<string>();
  for (let c = 0; c < COLS; c++) {
    if (board[row][c].gem !== -1) matched.add(key(row, c));
  }
  const n = matched.size;
  if (n === 0) return 0;
  clearAndDrop(board, matched);
  return n;
}

/** Crown activation: crown + all normal gems of `gemType`. Returns tiles cleared. */
export function applyCrownClearColor(board: Board, gemType: number): number {
  const matched = new Set<string>();
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      const t = board[r][c];
      if (t.special === "crown") matched.add(key(r, c));
      else if (isNormal(t) && t.gem === gemType) matched.add(key(r, c));
    }
  }
  const n = matched.size;
  if (n === 0) return 0;
  clearAndDrop(board, matched);
  return n;
}

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
