import { BlurView } from "expo-blur";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  Animated,
  Easing,
  Modal,
  PanResponder,
  Pressable,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  applyCoinRowBlast,
  applyCrownClearColor,
  applyHammerClear,
  cloneBoard,
  COLS,
  createBoard,
  findMatches,
  resolveOneMatchStep,
  ROWS,
  swapCells,
  swapIfMatch,
  type Board,
  type SpecialKind,
} from "../game/match3Engine";
import type { LevelDef } from "../game/levels";

const GEM_ASSETS = [
  require("../../assets/icons8-diamond-48.png"),
  require("../../assets/icons8-sapphire-48.png"),
  require("../../assets/icons8-jewel-48.png"),
  require("../../assets/icons8-emerald-48.png"),
] as const;

const COIN_ASSET = require("../../assets/icons8-coin-48.png");
const CROWN_ASSET = require("../../assets/icons8-crown-with-jewels-32.png");
const HAMMER_ASSET = require("../../assets/icons8-hammer-60.png");
const GOLD_POT_ASSET = require("../../assets/icons8-gold-pot-48.png");

const GEM_MARGIN = 4;
const CHAIN_STAGGER_MS = 42;
const SWAP_PRE_CASCADE_MS = 64;
const SPRING_FALL = { friction: 8, tension: 198 };
const SPRING_SPAWN = { friction: 6, tension: 210 };
const POP_MATCH_PEAK_MS = 80;
const POP_MATCH_OUT_MS = 165;
const POP_MATCH_PEAK_SCALE = 1.26;
const POP_MATCH_STAGGER_MS = 32;
const TAP_MOVE_MAX = 14;
const SWIPE_MIN = 22;

type Status = "play" | "won" | "lost";
type PMode = "none" | "hammer";

function coinsForWin(scoreVal: number): number {
  return 25 + Math.floor(scoreVal / 12);
}

type TileAnim = {
  x: Animated.Value;
  y: Animated.Value;
  popScale: Animated.Value;
  popOpacity: Animated.Value;
};

const C = {
  bgTop: "#0d0b14",
  bgMid: "#1a1430",
  panel: "rgba(255,255,255,0.09)",
  panelBorder: "rgba(255,255,255,0.16)",
  text: "rgba(255,248,242,0.95)",
  textMuted: "rgba(255,230,220,0.55)",
  accent: "#ff8b5c",
  accent2: "#7dd3fc",
  boardBg: "rgba(12,10,24,0.92)",
  boardBorder: "rgba(255,255,255,0.14)",
  cellShadow: "rgba(0,0,0,0.35)",
};

/** Win modal — matches AtmosphereBackground sun / twilight progression */
const WIN = {
  backdrop: ["rgba(48, 22, 10, 0.92)", "rgba(92, 48, 22, 0.88)", "rgba(28, 14, 8, 0.94)"] as const,
  title: "#2a1810",
  subtitle: "rgba(95, 58, 38, 0.88)",
  coins: "#c2410c",
  vault: "rgba(75, 48, 32, 0.78)",
};

function AtmosphereBackground({ progress }: { progress: Animated.Value }) {
  const nightOpacity = progress.interpolate({
    inputRange: [0, 0.2, 0.55, 0.9, 1],
    outputRange: [1, 0.88, 0.38, 0.05, 0],
    extrapolate: "clamp",
  });
  const twilightOpacity = progress.interpolate({
    inputRange: [0, 0.1, 0.4, 0.7, 1],
    outputRange: [0, 0.4, 0.7, 0.35, 0.08],
    extrapolate: "clamp",
  });
  const sunOpacity = progress.interpolate({
    inputRange: [0, 0.3, 0.65, 1],
    outputRange: [0, 0.2, 0.55, 0.9],
    extrapolate: "clamp",
  });

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      <LinearGradient
        colors={["#fff5eb", "#ffd8c2", "#ffb088"]}
        style={StyleSheet.absoluteFill}
      />
      <Animated.View style={[StyleSheet.absoluteFill, { opacity: sunOpacity }]}>
        <LinearGradient
          colors={["rgba(255,200,140,0.7)", "transparent"]}
          style={{ flex: 1 }}
          start={{ x: 0.4, y: 0 }}
          end={{ x: 0.6, y: 0.9 }}
        />
      </Animated.View>
      <Animated.View style={[StyleSheet.absoluteFill, { opacity: twilightOpacity }]}>
        <LinearGradient
          colors={["#1e1540", "#4d2f68", "#a85f52"]}
          style={{ flex: 1 }}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
        />
      </Animated.View>
      <Animated.View style={[StyleSheet.absoluteFill, { opacity: nightOpacity }]}>
        <LinearGradient
          colors={[C.bgTop, C.bgMid, "#120e22"]}
          style={{ flex: 1 }}
        />
      </Animated.View>
    </View>
  );
}

function GlassCard({
  children,
  style,
  intensity = 36,
  padding = 14,
  warm = false,
}: {
  children: React.ReactNode;
  style?: object;
  intensity?: number;
  padding?: number;
  /** Sunset / dawn glass — matches score “warmth” */
  warm?: boolean;
}) {
  return (
    <View style={[styles.glassBorder, style]}>
      {warm && (
        <LinearGradient
          colors={["rgba(255, 210, 170, 0.35)", "rgba(255, 165, 110, 0.12)"]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={StyleSheet.absoluteFill}
          pointerEvents="none"
        />
      )}
      <BlurView
        pointerEvents="none"
        intensity={intensity}
        tint={warm ? "light" : "dark"}
        style={StyleSheet.absoluteFill}
      />
      <View
        style={[
          styles.glassTint,
          { padding },
          warm && { backgroundColor: "rgba(255, 230, 210, 0.14)" },
        ]}
      >
        {children}
      </View>
    </View>
  );
}

function buildPosMap(b: Board): Map<string, { r: number; c: number }> {
  const m = new Map<string, { r: number; c: number }>();
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      const t = b[r][c];
      if (t.gem >= 0 && t.id) m.set(t.id, { r, c });
    }
  }
  return m;
}

/** Tile ids present in `before` but not after (matched / cleared / hammered). */
function collectRemovedTileIds(before: Board, after: Board): string[] {
  const afterIds = new Set<string>();
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      const t = after[r][c];
      if (t.gem >= 0 && t.id) afterIds.add(t.id);
    }
  }
  const removed: string[] = [];
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      const t = before[r][c];
      if (t.gem >= 0 && t.id && !afterIds.has(t.id)) removed.push(t.id);
    }
  }
  return removed;
}

type GemTileProps = {
  gemIndex: number;
  special: SpecialKind | null;
  size: number;
  selected: boolean;
  dimmed: boolean;
  warmth: number;
  slideX: Animated.Value;
  slideY: Animated.Value;
  popScale: Animated.Value;
  popOpacity: Animated.Value;
  onTap: () => void;
  onSwipe: (dr: number, dc: number) => void;
};

function GemTile({
  gemIndex,
  special,
  size,
  selected,
  dimmed,
  warmth,
  slideX,
  slideY,
  popScale,
  popOpacity,
  onTap,
  onSwipe,
}: GemTileProps) {
  const scale = useRef(new Animated.Value(1)).current;
  const tileScale = useMemo(
    () => Animated.multiply(scale, popScale),
    [scale, popScale]
  );
  const handlers = useRef({ onTap, onSwipe, dimmed });
  handlers.current = { onTap, onSwipe, dimmed };

  useEffect(() => {
    Animated.spring(scale, {
      toValue: selected ? 1.07 : 1,
      friction: 7,
      tension: 180,
      useNativeDriver: true,
    }).start();
  }, [selected, scale]);

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => !handlers.current.dimmed,
      onMoveShouldSetPanResponder: (_, g) =>
        !handlers.current.dimmed &&
        (Math.abs(g.dx) > 6 || Math.abs(g.dy) > 6),
      onPanResponderRelease: (_, g) => {
        const { onTap: tap, onSwipe: swipe, dimmed: d } = handlers.current;
        if (d) return;
        const dist = Math.hypot(g.dx, g.dy);
        if (dist < TAP_MOVE_MAX) {
          tap();
          return;
        }
        if (dist < SWIPE_MIN) {
          tap();
          return;
        }
        if (Math.abs(g.dx) > Math.abs(g.dy)) {
          if (g.dx > 0) swipe(0, 1);
          else swipe(0, -1);
        } else {
          if (g.dy > 0) swipe(1, 0);
          else swipe(-1, 0);
        }
      },
    })
  ).current;

  const safeIndex = Math.max(0, Math.min(gemIndex, GEM_ASSETS.length - 1));
  const gemSource =
    special === "coin"
      ? COIN_ASSET
      : special === "crown"
        ? CROWN_ASSET
        : GEM_ASSETS[safeIndex];
  const warmMix = Math.min(1, Math.max(0, warmth));
  const ring = selected
    ? warmMix > 0.5
      ? "rgba(255, 200, 140, 0.95)"
      : "rgba(255, 255, 255, 0.92)"
    : `rgba(255, 255, 255, ${0.14 + warmMix * 0.28})`;

  return (
    <View
      style={{ margin: GEM_MARGIN }}
      {...panResponder.panHandlers}
    >
      <Animated.View
        style={{
          width: size,
          height: size,
          borderRadius: size * 0.26,
          borderWidth: selected ? 2.5 : 1.5,
          borderColor: ring,
          backgroundColor:
            warmMix > 0.55
              ? "rgba(255, 240, 228, 0.18)"
              : "rgba(255, 255, 255, 0.1)",
          padding: size * 0.1,
          shadowColor: selected ? C.accent : "#000",
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: selected ? 0.45 : 0.2,
          shadowRadius: selected ? 10 : 4,
          elevation: selected ? 7 : 3,
          opacity: popOpacity,
          transform: [
            { translateX: slideX },
            { translateY: slideY },
            { scale: tileScale },
          ],
        }}
      >
        <Image
          source={gemSource}
          style={{ width: "100%", height: "100%" }}
          contentFit="contain"
          transition={80}
        />
      </Animated.View>
    </View>
  );
}

export type PuzzleScreenProps = {
  level: LevelDef;
  totalCoins: number;
  onCoinsEarned: (amount: number) => void;
  onBack: () => void;
  onLevelCleared: (levelId: number) => void;
  hasNextLevel: boolean;
  onNextLevel: () => void;
};

export function PuzzleScreen({
  level,
  totalCoins,
  onCoinsEarned,
  onBack,
  onLevelCleared,
  hasNextLevel,
  onNextLevel,
}: PuzzleScreenProps) {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();

  const [board, setBoard] = useState<Board>(() => createBoard());
  const boardRef = useRef(board);
  useEffect(() => {
    boardRef.current = board;
  }, [board]);

  const [moves, setMoves] = useState(level.moves);
  const [score, setScore] = useState(0);
  const [sel, setSel] = useState<{ r: number; c: number } | null>(null);
  const [status, setStatus] = useState<Status>("play");
  const [pMode, setPMode] = useState<PMode>("none");
  const [hammers, setHammers] = useState(level.hammers);
  const [isResolving, setIsResolving] = useState(false);
  const [lastWinCoins, setLastWinCoins] = useState(0);
  const [progressTrackW, setProgressTrackW] = useState(0);

  const cascadeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const winAwardedRef = useRef(false);
  const dawnProgressOpacity = useRef(new Animated.Value(0)).current;
  const dawnProgressLayout = useRef(new Animated.Value(0)).current;
  const tileAnimsRef = useRef<Map<string, TileAnim>>(new Map());

  const winOv = useRef(new Animated.Value(0)).current;
  const winCard = useRef(new Animated.Value(0)).current;
  const winPot = useRef(new Animated.Value(0)).current;
  const winTitle = useRef(new Animated.Value(0)).current;
  const winPotShake = useRef(new Animated.Value(0)).current;
  const winGlowPulse = useRef(new Animated.Value(1)).current;
  const winPotShakeLoopRef = useRef<Animated.CompositeAnimation | null>(null);
  const winGlowLoopRef = useRef<Animated.CompositeAnimation | null>(null);
  const lostOv = useRef(new Animated.Value(0)).current;
  const lostCard = useRef(new Animated.Value(0)).current;

  const cell = Math.min(54, (width - 40) / COLS - 8);
  const cellStride = cell + GEM_MARGIN * 2;

  const scoreProgress = Math.min(1, score / level.targetScore);
  const statusLight = scoreProgress > 0.55 || status === "won";

  const ensureAnim = useCallback((id: string): TileAnim => {
    let a = tileAnimsRef.current.get(id);
    if (!a) {
      a = {
        x: new Animated.Value(0),
        y: new Animated.Value(0),
        popScale: new Animated.Value(1),
        popOpacity: new Animated.Value(1),
      };
      tileAnimsRef.current.set(id, a);
    }
    return a;
  }, []);

  const playFalls = useCallback(
    (before: Board, after: Board, then: () => void) => {
      const removedIds = collectRemovedTileIds(before, after);

      const applyBoardAndSprings = () => {
        const beforePos = buildPosMap(before);
        const afterIds = new Set<string>();
        for (let r = 0; r < ROWS; r++) {
          for (let c = 0; c < COLS; c++) {
            const t = after[r][c];
            if (t.gem >= 0 && t.id) afterIds.add(t.id);
          }
        }
        for (const id of tileAnimsRef.current.keys()) {
          if (!afterIds.has(id)) tileAnimsRef.current.delete(id);
        }

        const springs: Animated.CompositeAnimation[] = [];

        for (let r = 0; r < ROWS; r++) {
          for (let c = 0; c < COLS; c++) {
            const t = after[r][c];
            if (t.gem < 0 || !t.id) continue;
            const a = ensureAnim(t.id);
            a.popScale.setValue(1);
            a.popOpacity.setValue(1);
            const prev = beforePos.get(t.id);
            if (prev) {
              const dx = (prev.c - c) * cellStride;
              const dy = (prev.r - r) * cellStride;
              a.x.setValue(dx);
              a.y.setValue(dy);
              if (dx !== 0 || dy !== 0) {
                springs.push(
                  Animated.parallel([
                    Animated.spring(a.x, {
                      toValue: 0,
                      ...SPRING_FALL,
                      useNativeDriver: true,
                    }),
                    Animated.spring(a.y, {
                      toValue: 0,
                      ...SPRING_FALL,
                      useNativeDriver: true,
                    }),
                  ])
                );
              }
            } else {
              a.popScale.setValue(0.88);
              a.x.setValue(0);
              a.y.setValue(-(r + 1) * cellStride * 1.06);
              springs.push(
                Animated.parallel([
                  Animated.spring(a.popScale, {
                    toValue: 1,
                    friction: 7,
                    tension: 260,
                    useNativeDriver: true,
                  }),
                  Animated.spring(a.x, {
                    toValue: 0,
                    ...SPRING_FALL,
                    useNativeDriver: true,
                  }),
                  Animated.spring(a.y, {
                    toValue: 0,
                    ...SPRING_SPAWN,
                    useNativeDriver: true,
                  }),
                ])
              );
            }
          }
        }

        setBoard(cloneBoard(after));
        boardRef.current = cloneBoard(after);

        if (springs.length === 0) {
          then();
          return;
        }
        Animated.parallel(springs).start((e) => {
          if (e.finished) then();
        });
      };

      if (removedIds.length === 0) {
        applyBoardAndSprings();
        return;
      }

      for (const id of removedIds) {
        const a = ensureAnim(id);
        a.popScale.setValue(1);
        a.popOpacity.setValue(1);
      }

      const popOne = (id: string) => {
        const a = ensureAnim(id);
        return Animated.parallel([
          Animated.sequence([
            Animated.timing(a.popScale, {
              toValue: POP_MATCH_PEAK_SCALE,
              duration: POP_MATCH_PEAK_MS,
              easing: Easing.out(Easing.quad),
              useNativeDriver: true,
            }),
            Animated.timing(a.popScale, {
              toValue: 0,
              duration: POP_MATCH_OUT_MS,
              easing: Easing.in(Easing.cubic),
              useNativeDriver: true,
            }),
          ]),
          Animated.timing(a.popOpacity, {
            toValue: 0,
            duration: POP_MATCH_PEAK_MS + POP_MATCH_OUT_MS - 20,
            easing: Easing.out(Easing.cubic),
            useNativeDriver: true,
          }),
        ]);
      };

      const popAnims = removedIds.map((id) => popOne(id));
      const popGroup =
        removedIds.length > 6
          ? Animated.stagger(POP_MATCH_STAGGER_MS, popAnims)
          : Animated.parallel(popAnims);

      popGroup.start(({ finished }) => {
        if (!finished) return;
        applyBoardAndSprings();
      });
    },
    [cellStride, ensureAnim]
  );

  const runProgressSpring = useCallback(
    (to: number) => {
      const config = { friction: 13, tension: 48 };
      Animated.parallel([
        Animated.spring(dawnProgressOpacity, {
          toValue: to,
          useNativeDriver: true,
          ...config,
        }),
        Animated.spring(dawnProgressLayout, {
          toValue: to,
          useNativeDriver: false,
          ...config,
        }),
      ]).start();
    },
    [dawnProgressLayout, dawnProgressOpacity]
  );

  useEffect(() => {
    const target =
      status === "won" ? 1 : Math.min(1, score / level.targetScore);
    runProgressSpring(target);
  }, [score, status, runProgressSpring, level.targetScore]);

  useEffect(() => {
    return () => {
      if (cascadeTimerRef.current) clearTimeout(cascadeTimerRef.current);
    };
  }, []);

  useEffect(() => {
    if (status !== "play") {
      return;
    }
    if (score < level.targetScore) {
      winAwardedRef.current = false;
      return;
    }
    if (winAwardedRef.current) return;
    winAwardedRef.current = true;
    const earned = coinsForWin(score);
    setLastWinCoins(earned);
    onCoinsEarned(earned);
    onLevelCleared(level.id);
    setStatus("won");
  }, [score, status, level.targetScore, level.id, onCoinsEarned, onLevelCleared]);

  useEffect(() => {
    if (status !== "play") return;
    if (moves <= 0 && score < level.targetScore) setStatus("lost");
  }, [moves, score, status, level.targetScore]);

  useEffect(() => {
    const stopWinMotion = () => {
      winPotShakeLoopRef.current?.stop();
      winGlowLoopRef.current?.stop();
      winPotShakeLoopRef.current = null;
      winGlowLoopRef.current = null;
      winPotShake.setValue(0);
      winGlowPulse.setValue(1);
    };

    if (status !== "won") {
      stopWinMotion();
      winOv.setValue(0);
      winCard.setValue(0);
      winPot.setValue(0);
      winTitle.setValue(0);
      return;
    }
    winOv.setValue(0);
    winCard.setValue(0);
    winPot.setValue(0);
    winTitle.setValue(0);
    stopWinMotion();
    Animated.parallel([
      Animated.timing(winOv, {
        toValue: 1,
        duration: 320,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.spring(winCard, {
        toValue: 1,
        friction: 9,
        tension: 78,
        useNativeDriver: true,
      }),
    ]).start(() => {
      Animated.parallel([
        Animated.spring(winPot, {
          toValue: 1,
          friction: 6,
          tension: 160,
          useNativeDriver: true,
        }),
        Animated.timing(winTitle, {
          toValue: 1,
          duration: 420,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
      ]).start(({ finished }) => {
        if (!finished) return;
        const shakeLoop = Animated.loop(
          Animated.sequence([
            Animated.timing(winPotShake, {
              toValue: 1,
              duration: 190,
              easing: Easing.inOut(Easing.quad),
              useNativeDriver: true,
            }),
            Animated.timing(winPotShake, {
              toValue: -1,
              duration: 190,
              easing: Easing.inOut(Easing.quad),
              useNativeDriver: true,
            }),
          ])
        );
        winPotShakeLoopRef.current = shakeLoop;
        shakeLoop.start();

        const glowLoop = Animated.loop(
          Animated.sequence([
            Animated.timing(winGlowPulse, {
              toValue: 1.07,
              duration: 1500,
              easing: Easing.inOut(Easing.sin),
              useNativeDriver: true,
            }),
            Animated.timing(winGlowPulse, {
              toValue: 1,
              duration: 1500,
              easing: Easing.inOut(Easing.sin),
              useNativeDriver: true,
            }),
          ])
        );
        winGlowLoopRef.current = glowLoop;
        glowLoop.start();
      });
    });
  }, [status, winOv, winCard, winPot, winTitle, winPotShake, winGlowPulse]);

  useEffect(() => {
    if (status !== "lost") {
      lostOv.setValue(0);
      lostCard.setValue(0);
      return;
    }
    lostOv.setValue(0);
    lostCard.setValue(0);
    Animated.parallel([
      Animated.timing(lostOv, {
        toValue: 1,
        duration: 300,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.spring(lostCard, {
        toValue: 1,
        friction: 9,
        tension: 72,
        useNativeDriver: true,
      }),
    ]).start();
  }, [status, lostOv, lostCard]);

  const runCascade = useCallback(
    (initial: Board) => {
      const working = cloneBoard(initial);

      const step = () => {
        const beforeSnap = cloneBoard(working);
        const res = resolveOneMatchStep(working);
        if (!res) {
          const finalB = cloneBoard(working);
          setBoard(finalB);
          boardRef.current = finalB;
          setIsResolving(false);
          cascadeTimerRef.current = null;
          return;
        }
        const afterSnap = cloneBoard(working);
        setScore((s) => s + res.scoreDelta);

        playFalls(beforeSnap, afterSnap, () => {
          cascadeTimerRef.current = setTimeout(step, CHAIN_STAGGER_MS);
        });
      };

      cascadeTimerRef.current = setTimeout(step, 0);
    },
    [playFalls]
  );

  const startCascadeFromBoard = useCallback(
    (b: Board, spendMove: boolean) => {
      if (cascadeTimerRef.current) clearTimeout(cascadeTimerRef.current);
      setIsResolving(true);
      if (spendMove) setMoves((m) => Math.max(0, m - 1));
      const w0 = cloneBoard(b);
      cascadeTimerRef.current = setTimeout(
        () => runCascade(w0),
        SWAP_PRE_CASCADE_MS
      );
    },
    [runCascade]
  );

  const playInvalidSwapNudge = useCallback(
    (r1: number, c1: number, r2: number, c2: number) => {
      const cur = boardRef.current;
      const idA = cur[r1][c1].id;
      const idB = cur[r2][c2].id;
      const aA = ensureAnim(idA);
      const aB = ensureAnim(idB);
      const s = cellStride;
      const nx = (c2 - c1) * s * 0.22;
      const ny = (r2 - r1) * s * 0.22;
      const mx = (c1 - c2) * s * 0.22;
      const my = (r1 - r2) * s * 0.22;

      Animated.sequence([
        Animated.parallel([
          Animated.timing(aA.x, {
            toValue: nx,
            duration: 85,
            useNativeDriver: true,
          }),
          Animated.timing(aA.y, {
            toValue: ny,
            duration: 85,
            useNativeDriver: true,
          }),
          Animated.timing(aB.x, {
            toValue: mx,
            duration: 85,
            useNativeDriver: true,
          }),
          Animated.timing(aB.y, {
            toValue: my,
            duration: 85,
            useNativeDriver: true,
          }),
        ]),
        Animated.parallel([
          Animated.spring(aA.x, {
            toValue: 0,
            friction: 5,
            tension: 380,
            useNativeDriver: true,
          }),
          Animated.spring(aA.y, {
            toValue: 0,
            friction: 5,
            tension: 380,
            useNativeDriver: true,
          }),
          Animated.spring(aB.x, {
            toValue: 0,
            friction: 5,
            tension: 380,
            useNativeDriver: true,
          }),
          Animated.spring(aB.y, {
            toValue: 0,
            friction: 5,
            tension: 380,
            useNativeDriver: true,
          }),
        ]),
      ]).start();
    },
    [cellStride, ensureAnim]
  );

  /** Swap: specials (coin / crown) activate without a 3-match; normals need matches. */
  const attemptSwap = useCallback(
    (r1: number, c1: number, r2: number, c2: number) => {
      const cur = boardRef.current;
      if (status !== "play" || isResolving) return;
      if (Math.abs(r1 - r2) + Math.abs(c1 - c2) !== 1) return;
      if (pMode === "hammer") return;

      const t1 = cur[r1][c1];
      const t2 = cur[r2][c2];

      if (t1.special && t2.special) {
        playInvalidSwapNudge(r1, c1, r2, c2);
        setSel(null);
        return;
      }

      if (t1.special === "crown" || t2.special === "crown") {
        const other = t1.special === "crown" ? t2 : t1;
        if (other.special !== null) {
          playInvalidSwapNudge(r1, c1, r2, c2);
          setSel(null);
          return;
        }
        const gemColor = other.gem;
        const b = cloneBoard(cur);
        swapCells(b, r1, c1, r2, c2);
        const cleared = applyCrownClearColor(b, gemColor);
        setScore((s) => s + cleared * 12);
        setSel(null);
        setBoard(b);
        boardRef.current = b;
        startCascadeFromBoard(b, true);
        return;
      }

      if (t1.special === "coin" || t2.special === "coin") {
        const other = t1.special === "coin" ? t2 : t1;
        if (other.special !== null) {
          playInvalidSwapNudge(r1, c1, r2, c2);
          setSel(null);
          return;
        }
        const b = cloneBoard(cur);
        swapCells(b, r1, c1, r2, c2);
        let coinRow = -1;
        for (let r = 0; r < ROWS; r++) {
          for (let c = 0; c < COLS; c++) {
            if (b[r][c].special === "coin") coinRow = r;
          }
        }
        if (coinRow < 0) {
          playInvalidSwapNudge(r1, c1, r2, c2);
          setSel(null);
          return;
        }
        const cleared = applyCoinRowBlast(b, coinRow);
        setScore((s) => s + cleared * 12);
        setSel(null);
        setBoard(b);
        boardRef.current = b;
        startCascadeFromBoard(b, true);
        return;
      }

      const probe = cloneBoard(cur);
      swapCells(probe, r1, c1, r2, c2);
      if (findMatches(probe).size === 0) {
        playInvalidSwapNudge(r1, c1, r2, c2);
        setSel(null);
        return;
      }

      const b = cloneBoard(cur);
      const ok = swapIfMatch(b, r1, c1, r2, c2);
      if (!ok) {
        playInvalidSwapNudge(r1, c1, r2, c2);
        setSel(null);
        return;
      }

      setSel(null);
      setBoard(b);
      boardRef.current = b;
      startCascadeFromBoard(b, true);
    },
    [
      isResolving,
      pMode,
      playInvalidSwapNudge,
      startCascadeFromBoard,
      status,
    ]
  );

  const onGemTap = useCallback(
    (r: number, c: number) => {
      if (status !== "play" || isResolving) return;

      if (pMode === "hammer") {
        if (hammers <= 0) {
          setPMode("none");
          return;
        }
        const before = cloneBoard(boardRef.current);
        const b = cloneBoard(boardRef.current);
        if (!applyHammerClear(b, r, c)) return;
        setHammers((h) => h - 1);
        setPMode("none");
        setScore((s) => s + 12);
        setMoves((m) => Math.max(0, m - 1));
        setIsResolving(true);
        playFalls(before, b, () => {
          cascadeTimerRef.current = setTimeout(() => runCascade(cloneBoard(b)), 20);
        });
        return;
      }

      if (!sel) {
        setSel({ r, c });
        return;
      }
      if (sel.r === r && sel.c === c) {
        setSel(null);
        return;
      }
      if (Math.abs(sel.r - r) + Math.abs(sel.c - c) !== 1) {
        setSel({ r, c });
        return;
      }
      attemptSwap(sel.r, sel.c, r, c);
    },
    [attemptSwap, hammers, isResolving, pMode, playFalls, runCascade, sel, status]
  );

  const onGemSwipe = useCallback(
    (r: number, c: number, dr: number, dc: number) => {
      if (status !== "play" || isResolving) return;
      if (pMode !== "none") return;
      const r2 = r + dr;
      const c2 = c + dc;
      if (r2 < 0 || r2 >= ROWS || c2 < 0 || c2 >= COLS) return;
      setSel(null);
      attemptSwap(r, c, r2, c2);
    },
    [attemptSwap, isResolving, pMode, status]
  );

  const resetRound = () => {
    if (cascadeTimerRef.current) {
      clearTimeout(cascadeTimerRef.current);
      cascadeTimerRef.current = null;
    }
    tileAnimsRef.current.clear();
    const nb = createBoard();
    setBoard(nb);
    boardRef.current = nb;
    setMoves(level.moves);
    setScore(0);
    setSel(null);
    setStatus("play");
    setPMode("none");
    setHammers(level.hammers);
    setIsResolving(false);
    setLastWinCoins(0);
    winAwardedRef.current = false;
    runProgressSpring(0);
  };

  const inputLocked = status !== "play" || isResolving;

  const barFillW =
    progressTrackW > 0
      ? dawnProgressLayout.interpolate({
          inputRange: [0, 1],
          outputRange: [8, progressTrackW],
          extrapolate: "clamp",
        })
      : 8;

  const labelMuted = statusLight ? "rgba(55,42,36,0.62)" : C.textMuted;
  const labelStrong = statusLight ? "rgba(38,28,22,0.96)" : C.text;

  const winBackdropOpacity = winOv.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 1],
  });
  const winCardScale = winCard.interpolate({
    inputRange: [0, 1],
    outputRange: [0.86, 1],
  });
  const winPotScale = winPot.interpolate({
    inputRange: [0, 1],
    outputRange: [0.42, 1],
  });
  const winTitleShift = winTitle.interpolate({
    inputRange: [0, 1],
    outputRange: [16, 0],
  });
  const winPotRotate = winPotShake.interpolate({
    inputRange: [-1, 1],
    outputRange: ["-7deg", "7deg"],
  });
  const winPotBob = winPotShake.interpolate({
    inputRange: [-1, 1],
    outputRange: [5, -5],
  });

  const lostBackdropOpacity = lostOv.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 1],
  });
  const lostCardScale = lostCard.interpolate({
    inputRange: [0, 1],
    outputRange: [0.88, 1],
  });

  return (
    <View style={{ flex: 1 }}>
      <View style={[StyleSheet.absoluteFill, { zIndex: 0 }]} pointerEvents="none">
        <AtmosphereBackground progress={dawnProgressOpacity} />
      </View>
      <View
        style={{
          flex: 1,
          paddingTop: insets.top + 8,
          paddingBottom: insets.bottom + 10,
          paddingHorizontal: 16,
        }}
      >
        <GlassCard padding={16} intensity={32} style={{ borderColor: C.panelBorder }}>
          <View style={styles.headerRow}>
            <Pressable
              onPress={onBack}
              hitSlop={14}
              style={({ pressed }) => [
                styles.headerBack,
                pressed && { opacity: 0.75 },
              ]}
            >
              <Text style={[styles.headerBackTxt, { color: labelStrong }]}>
                ‹
              </Text>
            </Pressable>
            <View style={{ flex: 1, paddingLeft: 4 }}>
              <Text style={[styles.brandSmall, { color: labelMuted }]}>
                GEM RUSH
              </Text>
              <Text
                style={[styles.brandTitle, { color: labelStrong }]}
                numberOfLines={1}
              >
                {level.name}
              </Text>
              <Text style={[styles.levelIdTag, { color: labelMuted }]}>
                Level {level.id}
              </Text>
            </View>
            <View style={{ alignItems: "flex-end" }}>
              <Text style={[styles.statLabel, { color: labelMuted }]}>goal</Text>
              <Text style={[styles.scoreBig, { color: labelStrong }]}>
                {score}
                <Text style={{ color: labelMuted, fontWeight: "700" }}>
                  {" "}
                  / {level.targetScore}
                </Text>
              </Text>
              <View style={styles.coinWallet}>
                <Image
                  source={GOLD_POT_ASSET}
                  style={{ width: 22, height: 22 }}
                  contentFit="contain"
                />
                <Text style={[styles.coinWalletTxt, { color: labelStrong }]}>
                  {totalCoins}
                </Text>
              </View>
            </View>
          </View>
          <View
            style={[
              styles.progressTrack,
              {
                backgroundColor: statusLight
                  ? "rgba(55,42,36,0.12)"
                  : "rgba(255,255,255,0.12)",
              },
            ]}
            onLayout={(e) => setProgressTrackW(e.nativeEvent.layout.width)}
          >
            <Animated.View
              style={{
                height: "100%",
                width: barFillW,
                borderRadius: 999,
                overflow: "hidden",
              }}
            >
              <LinearGradient
                colors={[C.accent, "#ffb347"]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={StyleSheet.absoluteFill}
              />
            </Animated.View>
          </View>
        </GlassCard>

        <View style={styles.movesRow}>
          <View style={[styles.movePill, { borderColor: C.panelBorder }]}>
            <Text style={[styles.statLabel, { color: labelMuted }]}>moves</Text>
            <Text
              style={[
                styles.movesBig,
                { color: statusLight ? "rgba(200,85,40,0.95)" : C.accent },
              ]}
            >
              {moves}
            </Text>
          </View>
          {pMode === "hammer" && (
            <View style={[styles.powerHintBox, { borderColor: C.panelBorder }]}>
              <Text style={[styles.powerHintTxt, { color: labelStrong }]}>
                Tap a gem to smash
              </Text>
            </View>
          )}
        </View>

        <View
          style={[
            styles.boardShell,
            {
              borderColor: C.boardBorder,
              backgroundColor: C.boardBg,
              opacity: status === "play" ? 1 : 0.45,
            },
          ]}
        >
          {Array.from({ length: ROWS }, (_, row) => (
            <View key={row} style={styles.boardRow}>
              {Array.from({ length: COLS }, (_, col) => {
                const tile = board[row][col];
                const animKey =
                  tile.gem >= 0 && tile.id ? tile.id : `empty-${row}-${col}`;
                const { x, y, popScale, popOpacity } = ensureAnim(animKey);
                return (
                  <GemTile
                    key={animKey}
                    gemIndex={tile.gem}
                    special={tile.special}
                    size={cell}
                    selected={sel?.r === row && sel.c === col}
                    dimmed={inputLocked}
                    warmth={scoreProgress}
                    slideX={x}
                    slideY={y}
                    popScale={popScale}
                    popOpacity={popOpacity}
                    onTap={() => onGemTap(row, col)}
                    onSwipe={(dr, dc) => onGemSwipe(row, col, dr, dc)}
                  />
                );
              })}
            </View>
          ))}
        </View>

        <View style={styles.bottomBar}>
          <Pressable
            onPress={() =>
              setPMode((m) => (m === "hammer" ? "none" : "hammer"))
            }
            disabled={hammers <= 0 || inputLocked}
            style={({ pressed }) => [
              styles.hammerChip,
              hammers <= 0 && styles.powerChipOff,
              pMode === "hammer" && styles.powerChipOn,
              pressed && { opacity: 0.88 },
            ]}
          >
            <Image
              source={HAMMER_ASSET}
              style={styles.hammerIcon}
              contentFit="contain"
            />
            <Text style={[styles.hammerCount, { color: labelStrong }]}>
              x{hammers}
            </Text>
          </Pressable>
        </View>
      </View>

      <Modal visible={status === "won"} transparent animationType="none">
        <View style={styles.modalOverlayFill}>
          <Animated.View
            pointerEvents="none"
            style={[StyleSheet.absoluteFill, { opacity: winBackdropOpacity }]}
          >
            <LinearGradient
              colors={[...WIN.backdrop]}
              locations={[0, 0.42, 1]}
              style={StyleSheet.absoluteFill}
              start={{ x: 0.1, y: 0 }}
              end={{ x: 0.9, y: 1 }}
            />
          </Animated.View>
          <Animated.View
            style={[
              styles.modalCardWrap,
              {
                opacity: winCard,
                transform: [{ scale: winCardScale }],
              },
            ]}
          >
            <Animated.View
              pointerEvents="none"
              style={[
                styles.modalGlowRing,
                { transform: [{ scale: winGlowPulse }] },
              ]}
            />
            <GlassCard
              padding={24}
              style={styles.modalCardWarm}
              intensity={44}
              warm
            >
              <View style={styles.winPotRing}>
                <Animated.View
                  style={{
                    transform: [
                      { scale: winPotScale },
                      { translateY: winPotBob },
                      { rotate: winPotRotate },
                    ],
                  }}
                >
                  <Image
                    source={GOLD_POT_ASSET}
                    style={{ width: 92, height: 92 }}
                    contentFit="contain"
                  />
                </Animated.View>
              </View>
              <Animated.View
                style={{
                  opacity: winTitle,
                  transform: [{ translateY: winTitleShift }],
                }}
              >
                <Text style={[styles.winTitle, { color: WIN.title }]}>
                  Level {level.id} clear
                </Text>
                <Text style={[styles.winSubtitle, { color: WIN.subtitle }]}>
                  {level.name} — rewards added to your vault
                </Text>
                <View style={styles.winStatRow}>
                  <Text style={[styles.winCoinsLine, { color: WIN.coins }]}>
                    +{lastWinCoins} coins
                  </Text>
                </View>
                <Text style={[styles.winTotalLine, { color: WIN.vault }]}>
                  Vault · {totalCoins} coins
                </Text>
              </Animated.View>
              <Animated.View style={{ opacity: winTitle }}>
                {hasNextLevel ? (
                  <Pressable
                    onPress={onNextLevel}
                    style={({ pressed }) => [
                      styles.modalBtnWrap,
                      { marginTop: 22, opacity: pressed ? 0.92 : 1 },
                    ]}
                  >
                    <LinearGradient
                      colors={["#ffd6a8", "#ffb347", "#ea580c"]}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 1 }}
                      style={styles.modalBtnGrad}
                    >
                      <Text style={styles.modalBtnText}>Next level</Text>
                    </LinearGradient>
                  </Pressable>
                ) : (
                  <Pressable
                    onPress={resetRound}
                    style={({ pressed }) => [
                      styles.modalBtnWrap,
                      { marginTop: 22, opacity: pressed ? 0.92 : 1 },
                    ]}
                  >
                    <LinearGradient
                      colors={["#ffd6a8", "#ffb347", "#ea580c"]}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 1 }}
                      style={styles.modalBtnGrad}
                    >
                      <Text style={styles.modalBtnText}>Play again</Text>
                    </LinearGradient>
                  </Pressable>
                )}
                <View
                  style={[
                    styles.winActionsRow,
                    { marginTop: hasNextLevel ? 14 : 12 },
                  ]}
                >
                  {hasNextLevel && (
                    <Pressable
                      onPress={resetRound}
                      style={({ pressed }) => [
                        styles.winSecondaryBtn,
                        pressed && { opacity: 0.85 },
                      ]}
                    >
                      <Text
                        style={[styles.winSecondaryTxt, { color: WIN.subtitle }]}
                      >
                        Replay
                      </Text>
                    </Pressable>
                  )}
                  <Pressable
                    onPress={onBack}
                    style={({ pressed }) => [
                      styles.winSecondaryBtn,
                      pressed && { opacity: 0.85 },
                    ]}
                  >
                    <Text
                      style={[styles.winSecondaryTxt, { color: WIN.subtitle }]}
                    >
                      Menu
                    </Text>
                  </Pressable>
                </View>
              </Animated.View>
            </GlassCard>
          </Animated.View>
        </View>
      </Modal>

      <Modal visible={status === "lost"} transparent animationType="none">
        <View style={styles.modalOverlayFill}>
          <Animated.View
            pointerEvents="none"
            style={[
              StyleSheet.absoluteFill,
              {
                backgroundColor: "rgba(10,6,22,0.82)",
                opacity: lostBackdropOpacity,
              },
            ]}
          />
          <Animated.View
            style={[
              styles.modalCardWrap,
              {
                opacity: lostCard,
                transform: [{ scale: lostCardScale }],
              },
            ]}
          >
            <GlassCard padding={24} style={styles.modalCardLost} intensity={46}>
              <View style={styles.lostIconBlob}>
                <Text style={styles.lostEmoji}>✦</Text>
              </View>
              <Text style={[styles.modalTitle, { color: labelStrong }]}>
                No moves left
              </Text>
              <Text style={[styles.modalBody, { color: labelMuted }]}>
                So close — tap below and give it another shot.
              </Text>
              <Pressable
                onPress={resetRound}
                style={({ pressed }) => [
                  styles.modalBtnWrap,
                  { marginTop: 20, opacity: pressed ? 0.92 : 1 },
                ]}
              >
                <LinearGradient
                  colors={["#c4b5fd", "#8b5cf6"]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.modalBtnGrad}
                >
                  <Text style={[styles.modalBtnText, { color: "#1a1030" }]}>
                    Try again
                  </Text>
                </LinearGradient>
              </Pressable>
            </GlassCard>
          </Animated.View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  glassBorder: {
    borderRadius: 20,
    overflow: "hidden",
    borderWidth: 1.5,
    borderColor: "rgba(255,255,255,0.12)",
  },
  glassTint: {
    backgroundColor: "rgba(255,255,255,0.06)",
  },
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },
  brandSmall: {
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 3,
  },
  brandTitle: {
    marginTop: 4,
    fontSize: 22,
    fontWeight: "900",
    letterSpacing: -0.6,
  },
  headerBack: {
    width: 38,
    height: 40,
    justifyContent: "center",
    marginRight: 2,
  },
  headerBackTxt: {
    fontSize: 36,
    fontWeight: "200",
    lineHeight: 38,
    marginTop: -4,
  },
  levelIdTag: {
    marginTop: 3,
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 0.4,
  },
  statLabel: {
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 1.2,
    textTransform: "uppercase",
  },
  scoreBig: {
    marginTop: 4,
    fontSize: 20,
    fontWeight: "800",
    fontVariant: ["tabular-nums"],
  },
  coinWallet: {
    marginTop: 8,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    alignSelf: "flex-end",
  },
  coinWalletTxt: {
    fontSize: 16,
    fontWeight: "800",
    fontVariant: ["tabular-nums"],
  },
  progressTrack: {
    marginTop: 14,
    height: 9,
    borderRadius: 999,
    overflow: "hidden",
  },
  movesRow: {
    marginTop: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  movePill: {
    minWidth: 100,
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 16,
    borderWidth: 1.5,
    backgroundColor: "rgba(255,255,255,0.05)",
    alignItems: "center",
  },
  movesBig: {
    marginTop: 2,
    fontSize: 28,
    fontWeight: "900",
    fontVariant: ["tabular-nums"],
  },
  powerHintBox: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 14,
    borderWidth: 1.5,
    backgroundColor: "rgba(255,255,255,0.05)",
    justifyContent: "center",
  },
  powerHintTxt: {
    fontSize: 12,
    fontWeight: "600",
    textAlign: "center",
  },
  boardShell: {
    marginTop: 16,
    alignSelf: "center",
    paddingVertical: 10,
    paddingHorizontal: 8,
    borderRadius: 22,
    borderWidth: 2,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.35,
    shadowRadius: 20,
    elevation: 12,
  },
  boardRow: {
    flexDirection: "row",
    justifyContent: "center",
  },
  bottomBar: {
    marginTop: 18,
    width: "100%",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-start",
  },
  hammerChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: "rgba(255,255,255,0.2)",
    backgroundColor: "rgba(255,255,255,0.08)",
  },
  hammerIcon: {
    width: 44,
    height: 44,
  },
  hammerCount: {
    fontSize: 17,
    fontWeight: "900",
    fontVariant: ["tabular-nums"],
    letterSpacing: 0.5,
  },
  powerChipOff: { opacity: 0.38 },
  powerChipOn: {
    borderColor: "rgba(255, 180, 120, 0.65)",
    backgroundColor: "rgba(255, 140, 80, 0.15)",
  },
  winPotRing: {
    alignItems: "center",
    marginBottom: 8,
  },
  winTitle: {
    marginTop: 4,
    fontSize: 26,
    fontWeight: "900",
    textAlign: "center",
    letterSpacing: -0.5,
  },
  winSubtitle: {
    marginTop: 8,
    fontSize: 13,
    fontWeight: "600",
    textAlign: "center",
    lineHeight: 18,
  },
  winStatRow: {
    marginTop: 16,
    alignItems: "center",
  },
  winCoinsLine: {
    fontSize: 22,
    fontWeight: "900",
    fontVariant: ["tabular-nums"],
  },
  winTotalLine: {
    marginTop: 8,
    fontSize: 14,
    fontWeight: "600",
    textAlign: "center",
    fontVariant: ["tabular-nums"],
  },
  modalOverlayFill: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 22,
  },
  modalCardWrap: {
    width: "100%",
    maxWidth: 352,
    position: "relative",
  },
  modalGlowRing: {
    position: "absolute",
    top: -36,
    alignSelf: "center",
    width: 216,
    height: 216,
    borderRadius: 108,
    backgroundColor: "rgba(255, 150, 72, 0.28)",
    borderWidth: 1,
    borderColor: "rgba(255, 200, 140, 0.35)",
  },
  modalCardWarm: {
    width: "100%",
    borderWidth: 2,
    borderColor: "rgba(255, 195, 140, 0.55)",
    shadowColor: "#ea580c",
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.28,
    shadowRadius: 24,
    elevation: 16,
  },
  modalCardLost: {
    width: "100%",
    maxWidth: 340,
    borderWidth: 1.5,
    borderColor: "rgba(180, 170, 255, 0.35)",
  },
  lostIconBlob: {
    alignSelf: "center",
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: "rgba(139, 92, 246, 0.2)",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 14,
  },
  lostEmoji: {
    fontSize: 26,
    color: "rgba(200, 190, 255, 0.95)",
  },
  modalTitle: {
    textAlign: "center",
    fontSize: 24,
    fontWeight: "800",
  },
  modalBody: {
    marginTop: 10,
    textAlign: "center",
    fontSize: 14,
    lineHeight: 22,
    fontWeight: "500",
  },
  modalBtnWrap: {
    marginTop: 22,
    borderRadius: 16,
    overflow: "hidden",
  },
  modalBtnGrad: {
    paddingVertical: 15,
    alignItems: "center",
  },
  modalBtnText: {
    fontSize: 16,
    fontWeight: "800",
    color: "rgba(40,24,16,0.96)",
  },
  winActionsRow: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 28,
    flexWrap: "wrap",
  },
  winSecondaryBtn: {
    paddingVertical: 10,
    paddingHorizontal: 12,
  },
  winSecondaryTxt: {
    fontSize: 15,
    fontWeight: "800",
  },
});
