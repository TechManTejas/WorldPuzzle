import AsyncStorage from "@react-native-async-storage/async-storage";

import { LEVEL_COUNT } from "../game/levels";

const KEY = "@gemrush/progress/v1";

export type SavedProgress = {
  /** Highest level index the player may start (1-based). Level 1 always unlocked. */
  maxLevelUnlocked: number;
  totalCoins: number;
};

const defaultProgress: SavedProgress = {
  maxLevelUnlocked: 1,
  totalCoins: 0,
};

export async function loadProgress(): Promise<SavedProgress> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    if (!raw) return { ...defaultProgress };
    const parsed = JSON.parse(raw) as Partial<SavedProgress>;
    return {
      maxLevelUnlocked: Math.max(
        1,
        Math.min(
          typeof parsed.maxLevelUnlocked === "number"
            ? parsed.maxLevelUnlocked
            : 1,
          LEVEL_COUNT
        )
      ),
      totalCoins: Math.max(
        0,
        typeof parsed.totalCoins === "number" ? Math.floor(parsed.totalCoins) : 0
      ),
    };
  } catch {
    return { ...defaultProgress };
  }
}

export async function saveProgress(p: SavedProgress): Promise<void> {
  try {
    await AsyncStorage.setItem(KEY, JSON.stringify(p));
  } catch {
    /* ignore */
  }
}
