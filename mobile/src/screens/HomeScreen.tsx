import { BlurView } from "expo-blur";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import React from "react";
import {
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { LEVELS, type LevelDef } from "../game/levels";
import type { SavedProgress } from "../storage/gameProgress";

const GOLD_POT_ASSET = require("../../assets/icons8-gold-pot-48.png");

const C = {
  text: "rgba(255,248,242,0.94)",
  muted: "rgba(255,230,220,0.45)",
  dim: "rgba(255,255,255,0.18)",
  accent: "#ff8b5c",
  line: "rgba(255,255,255,0.09)",
  card: "rgba(255,255,255,0.06)",
  cardEdge: "rgba(255,255,255,0.12)",
};

type Props = {
  progress: SavedProgress;
  onPlayLevel: (level: LevelDef) => void;
};

function LevelRow({
  lvl,
  unlocked,
  onPress,
}: {
  lvl: LevelDef;
  unlocked: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={!unlocked}
      style={({ pressed }) => [
        styles.rowOuter,
        unlocked && pressed && { opacity: 0.92 },
      ]}
    >
      <View style={[styles.rowCard, !unlocked && styles.rowCardLocked]}>
        {!unlocked && (
          <>
            <BlurView
              intensity={52}
              tint="dark"
              style={StyleSheet.absoluteFill}
              pointerEvents="none"
            />
            <View style={styles.rowDimOverlay} pointerEvents="none" />
          </>
        )}
        <View style={styles.rowInner}>
          <View style={[styles.badge, !unlocked && styles.badgeMuted]}>
            <Text
              style={[styles.badgeTxt, !unlocked && styles.badgeTxtMuted]}
            >
              {lvl.id}
            </Text>
          </View>
          <View style={styles.rowTextCol}>
            <Text
              style={[styles.rowTitle, !unlocked && styles.rowTitleMuted]}
              numberOfLines={1}
            >
              {unlocked ? lvl.name : "\u2014"}
            </Text>
            {unlocked && (
              <Text style={styles.rowMeta}>
                Goal {lvl.targetScore.toLocaleString()} · {lvl.moves} moves
              </Text>
            )}
          </View>
          {unlocked ? (
            <Text style={styles.chevron}>›</Text>
          ) : (
            <View style={styles.chevronSpacer} />
          )}
        </View>
      </View>
    </Pressable>
  );
}

export function HomeScreen({ progress, onPlayLevel }: Props) {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const maxW = Math.min(400, width - 32);

  return (
    <View style={styles.root}>
      <LinearGradient
        colors={["#08060e", "#12101c", "#1a1430"]}
        style={StyleSheet.absoluteFill}
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0.5, y: 1 }}
      />
      <View
        style={[
          styles.stickyHeader,
          {
            paddingTop: insets.top + 16,
            paddingBottom: 12,
          },
        ]}
      >
        <View style={[styles.headerInner, { maxWidth: maxW }]}>
          <View style={styles.hero}>
            <Text style={styles.heroKicker}>GEM RUSH</Text>
            <View style={styles.walletPill}>
              <Image
                source={GOLD_POT_ASSET}
                style={{ width: 24, height: 24 }}
                contentFit="contain"
              />
              <Text style={styles.walletNum}>{progress.totalCoins}</Text>
              <View style={styles.walletDivider} />
              <Text style={styles.walletLbl}>Vault</Text>
            </View>
          </View>
          <View style={styles.sectionHead}>
            <View style={styles.sectionRule} />
            <Text style={styles.sectionLbl}>Levels</Text>
            <View style={styles.sectionRule} />
          </View>
        </View>
      </View>

      <FlatList
        data={LEVELS}
        keyExtractor={(item) => String(item.id)}
        renderItem={({ item: lvl }) => {
          const unlocked = lvl.id <= progress.maxLevelUnlocked;
          return (
            <LevelRow
              lvl={lvl}
              unlocked={unlocked}
              onPress={() => onPlayLevel(lvl)}
            />
          );
        }}
        ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
        style={styles.listScroll}
        contentContainerStyle={[
          styles.listScrollContent,
          {
            paddingBottom: insets.bottom + 28,
            maxWidth: maxW,
            width: "100%",
            alignSelf: "center",
          },
        ]}
        showsVerticalScrollIndicator
        keyboardShouldPersistTaps="handled"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  stickyHeader: {
    paddingHorizontal: 20,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "rgba(255,255,255,0.06)",
  },
  headerInner: {
    width: "100%",
    alignSelf: "center",
  },
  listScroll: {
    flex: 1,
    minHeight: 0,
  },
  listScrollContent: {
    paddingHorizontal: 20,
    paddingTop: 12,
  },
  hero: {
    width: "100%",
    marginBottom: 20,
    alignItems: "center",
  },
  heroKicker: {
    marginTop: 0,
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 4,
    color: C.muted,
  },
  walletPill: {
    marginTop: 24,
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.05)",
    borderWidth: 1,
    borderColor: C.line,
    gap: 10,
  },
  walletNum: {
    fontSize: 19,
    fontWeight: "800",
    color: C.text,
    fontVariant: ["tabular-nums"],
  },
  walletDivider: {
    width: 1,
    height: 16,
    backgroundColor: C.line,
  },
  walletLbl: {
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 1.5,
    color: C.muted,
    textTransform: "uppercase",
  },
  sectionHead: {
    width: "100%",
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginBottom: 0,
  },
  sectionRule: {
    flex: 1,
    height: StyleSheet.hairlineWidth,
    backgroundColor: C.line,
  },
  sectionLbl: {
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 3,
    color: C.muted,
    textTransform: "uppercase",
  },
  rowOuter: {
    width: "100%",
  },
  rowCard: {
    borderRadius: 14,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: C.cardEdge,
    backgroundColor: C.card,
  },
  rowCardLocked: {
    borderColor: "rgba(255,255,255,0.05)",
    backgroundColor: "rgba(0,0,0,0.25)",
  },
  rowDimOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(8,6,14,0.42)",
  },
  rowInner: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 14,
    paddingHorizontal: 14,
    gap: 12,
  },
  badge: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: "rgba(255,139,92,0.16)",
    borderWidth: 1,
    borderColor: "rgba(255,139,92,0.35)",
    alignItems: "center",
    justifyContent: "center",
  },
  badgeMuted: {
    backgroundColor: "rgba(255,255,255,0.04)",
    borderColor: "rgba(255,255,255,0.06)",
  },
  badgeTxt: {
    fontSize: 17,
    fontWeight: "900",
    color: C.accent,
    fontVariant: ["tabular-nums"],
  },
  badgeTxtMuted: {
    color: C.dim,
  },
  rowTextCol: {
    flex: 1,
    minWidth: 0,
  },
  rowTitle: {
    fontSize: 16,
    fontWeight: "800",
    color: C.text,
    letterSpacing: -0.3,
  },
  rowTitleMuted: {
    color: C.dim,
    fontWeight: "700",
  },
  rowMeta: {
    marginTop: 3,
    fontSize: 12,
    fontWeight: "600",
    color: C.muted,
    letterSpacing: 0.2,
  },
  chevron: {
    fontSize: 22,
    fontWeight: "300",
    color: "rgba(255,255,255,0.35)",
    marginTop: -2,
  },
  chevronSpacer: {
    width: 14,
  },
});
