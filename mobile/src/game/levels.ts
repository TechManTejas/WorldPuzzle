export type LevelDef = {
  id: number;
  name: string;
  /** Score needed to clear the level */
  targetScore: number;
  moves: number;
  hammers: number;
};

/**
 * Difficulty ramps by raising the goal and trimming moves / hammers.
 * Board size stays 6×6; tuning is goal vs. resources.
 */
export const LEVELS: LevelDef[] = [
  { id: 1, name: "First light", targetScore: 280, moves: 24, hammers: 3 },
  { id: 2, name: "Morning haze", targetScore: 320, moves: 23, hammers: 3 },
  { id: 3, name: "Sunrise run", targetScore: 360, moves: 22, hammers: 3 },
  { id: 4, name: "Golden hour", targetScore: 400, moves: 21, hammers: 3 },
  { id: 5, name: "Heat shimmer", targetScore: 440, moves: 20, hammers: 2 },
  { id: 6, name: "High noon", targetScore: 480, moves: 19, hammers: 2 },
  { id: 7, name: "Long shadows", targetScore: 520, moves: 18, hammers: 2 },
  { id: 8, name: "Twilight gems", targetScore: 560, moves: 17, hammers: 2 },
  { id: 9, name: "Dusk rush", targetScore: 600, moves: 16, hammers: 1 },
  { id: 10, name: "Starfall", targetScore: 650, moves: 15, hammers: 1 },
];

export function getLevel(id: number): LevelDef | undefined {
  return LEVELS.find((l) => l.id === id);
}

export const LEVEL_COUNT = LEVELS.length;
