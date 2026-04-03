import "./global.css";
import * as NavigationBar from "expo-navigation-bar";
import * as SystemUI from "expo-system-ui";
import { StatusBar } from "expo-status-bar";
import React, { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, Platform, View } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { LEVEL_COUNT, getLevel } from "./src/game/levels";
import { HomeScreen } from "./src/screens/HomeScreen";
import { PuzzleScreen } from "./src/screens/PuzzleScreen";
import {
  loadProgress,
  saveProgress,
  type SavedProgress,
} from "./src/storage/gameProgress";

export default function App() {
  const [progress, setProgress] = useState<SavedProgress>({
    maxLevelUnlocked: 1,
    totalCoins: 0,
  });
  const [hydrated, setHydrated] = useState(false);
  const [screen, setScreen] = useState<"home" | "game">("home");
  const [activeLevelId, setActiveLevelId] = useState(1);

  useEffect(() => {
    void SystemUI.setBackgroundColorAsync("#07080d");
    if (Platform.OS === "android") {
      void NavigationBar.setVisibilityAsync("hidden").catch(() => undefined);
    }
  }, []);

  useEffect(() => {
    loadProgress().then((p) => {
      setProgress(p);
      setHydrated(true);
    });
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    void saveProgress(progress);
  }, [progress, hydrated]);

  const applyCoins = useCallback((amount: number) => {
    setProgress((p) => ({
      ...p,
      totalCoins: Math.max(0, p.totalCoins + amount),
    }));
  }, []);

  const onLevelCleared = useCallback((clearedLevelId: number) => {
    setProgress((p) => ({
      ...p,
      maxLevelUnlocked: Math.min(
        LEVEL_COUNT,
        Math.max(p.maxLevelUnlocked, clearedLevelId + 1)
      ),
    }));
  }, []);

  const level = getLevel(activeLevelId);

  if (!hydrated) {
    return (
      <SafeAreaProvider>
        <StatusBar hidden />
        <View className="flex-1 bg-void items-center justify-center">
          <ActivityIndicator size="large" color="#ff8b5c" />
        </View>
      </SafeAreaProvider>
    );
  }

  return (
    <SafeAreaProvider>
      <StatusBar hidden />
      <View className="flex-1 bg-void">
        {screen === "home" ? (
          <HomeScreen
            progress={progress}
            onPlayLevel={(lvl) => {
              setActiveLevelId(lvl.id);
              setScreen("game");
            }}
          />
        ) : level ? (
          <PuzzleScreen
            key={level.id}
            level={level}
            totalCoins={progress.totalCoins}
            onCoinsEarned={applyCoins}
            onBack={() => setScreen("home")}
            onLevelCleared={onLevelCleared}
            hasNextLevel={activeLevelId < LEVEL_COUNT}
            onNextLevel={() => setActiveLevelId((id) => id + 1)}
          />
        ) : null}
      </View>
    </SafeAreaProvider>
  );
}
