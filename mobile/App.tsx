import "./global.css";
import * as NavigationBar from "expo-navigation-bar";
import * as SystemUI from "expo-system-ui";
import { StatusBar } from "expo-status-bar";
import React, { useEffect } from "react";
import { Platform, View } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { SlidePuzzleScreen } from "./src/screens/SlidePuzzleScreen";

export default function App() {
  useEffect(() => {
    void SystemUI.setBackgroundColorAsync("#07080d");
    if (Platform.OS === "android") {
      void NavigationBar.setVisibilityAsync("hidden").catch(() => undefined);
    }
  }, []);

  return (
    <SafeAreaProvider>
      <StatusBar hidden />
      <View className="flex-1 bg-void">
        <SlidePuzzleScreen />
      </View>
    </SafeAreaProvider>
  );
}
