import "./global.css";
import React from "react";
import { View } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { PuzzleScreen } from "./src/screens/PuzzleScreen";

export default function App() {
  return (
    <SafeAreaProvider>
      <View className="flex-1 bg-void">
        <PuzzleScreen />
      </View>
    </SafeAreaProvider>
  );
}
