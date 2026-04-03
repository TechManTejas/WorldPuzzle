import { BlurView } from "expo-blur";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { StatusBar } from "expo-status-bar";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  Animated,
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

const TARGET = 420;
const START_MOVES = 22;
const GEM_MARGIN = 4;
const CHAIN_STAGGER_MS = 42;
const SWAP_PRE_CASCADE_MS = 64;
const SPRING_FALL = { friction: 8, tension: 198 };
const SPRING_SPAWN = { friction: 7, tension: 188 };
const TAP_MOVE_MAX = 14;
const SWIPE_MIN = 22;

const STARTING_HAMMERS = 3;

type Status = "play" | "won" | "lost";
type PMode = "none" | "hammer";

function coinsForWin(scoreVal: number): number {
  return 25 + Math.floor(scoreVal / 12);
}

type TileAnim = { x: Animated.Value; y: Animated.Value };

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
}: {
  children: React.ReactNode;
  style?: object;
  intensity?: number;
  padding?: number;
}) {
  return (
    <View style={[styles.glassBorder, style]}>
      <BlurView
        pointerEvents="none"
        intensity={intensity}
        tint="dark"
        style={StyleSheet.absoluteFill}
      />
      <View style={[styles.glassTint, { padding }]}>{children}</View>
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

type GemTileProps = {
  gemIndex: number;
  special: SpecialKind | null;
  size: number;
  selected: boolean;
  dimmed: boolean;
  warmth: number;
  slideX: Animated.Value;
  slideY: Animated.Value;
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
  onTap,
  onSwipe,
}: GemTileProps) {
  const scale = useRef(new Animated.Value(1)).current;
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
          transform: [
            { translateX: slideX },
            { translateY: slideY },
            { scale },
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

export function PuzzleScreen() {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();

  const [board, setBoard] = useState<Board>(() => createBoard());
  const boardRef = useRef(board);
  useEffect(() => {
    boardRef.current = board;
  }, [board]);

  const [moves, setMoves] = useState(START_MOVES);
  const [score, setScore] = useState(0);
  const [sel, setSel] = useState<{ r: number; c: number } | null>(null);
  const [status, setStatus] = useState<Status>("play");
  const [pMode, setPMode] = useState<PMode>("none");
  const [hammers, setHammers] = useState(STARTING_HAMMERS);
  const [isResolving, setIsResolving] = useState(false);
  const [totalCoins, setTotalCoins] = useState(0);
  const [lastWinCoins, setLastWinCoins] = useState(0);
  const [progressTrackW, setProgressTrackW] = useState(0);

  const cascadeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const winAwardedRef = useRef(false);
  const dawnProgressOpacity = useRef(new Animated.Value(0)).current;
  const dawnProgressLayout = useRef(new Animated.Value(0)).current;
  const tileAnimsRef = useRef<Map<string, TileAnim>>(new Map());

  const cell = Math.min(54, (width - 40) / COLS - 8);
  const cellStride = cell + GEM_MARGIN * 2;

  const scoreProgress = Math.min(1, score / TARGET);
  const statusLight = scoreProgress > 0.55 || status === "won";

  const ensureAnim = useCallback((id: string): TileAnim => {
    let a = tileAnimsRef.current.get(id);
    if (!a) {
      a = { x: new Animated.Value(0), y: new Animated.Value(0) };
      tileAnimsRef.current.set(id, a);
    }
    return a;
  }, []);

  const playFalls = useCallback(
    (before: Board, after: Board, then: () => void) => {
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
            a.x.setValue(0);
            a.y.setValue(-(r + 1) * cellStride * 1.06);
            springs.push(
              Animated.parallel([
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
    const target = status === "won" ? 1 : Math.min(1, score / TARGET);
    runProgressSpring(target);
  }, [score, status, runProgressSpring]);

  useEffect(() => {
    return () => {
      if (cascadeTimerRef.current) clearTimeout(cascadeTimerRef.current);
    };
  }, []);

  useEffect(() => {
    if (status !== "play") {
      return;
    }
    if (score < TARGET) {
      winAwardedRef.current = false;
      return;
    }
    if (winAwardedRef.current) return;
    winAwardedRef.current = true;
    const earned = coinsForWin(score);
    setLastWinCoins(earned);
    setTotalCoins((c) => c + earned);
    setStatus("won");
  }, [score, status]);

  useEffect(() => {
    if (status !== "play") return;
    if (moves <= 0 && score < TARGET) setStatus("lost");
  }, [moves, score, status]);

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
    setMoves(START_MOVES);
    setScore(0);
    setSel(null);
    setStatus("play");
    setPMode("none");
    setHammers(STARTING_HAMMERS);
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
  const hintColor = statusLight ? "rgba(55,42,36,0.5)" : "rgba(255,220,210,0.42)";

  return (
    <View style={{ flex: 1 }}>
      <View style={[StyleSheet.absoluteFill, { zIndex: 0 }]} pointerEvents="none">
        <AtmosphereBackground progress={dawnProgressOpacity} />
      </View>
      <StatusBar style={statusLight ? "dark" : "light"} />

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
            <View style={{ flex: 1 }}>
              <Text style={[styles.brandSmall, { color: labelMuted }]}>
                GEM RUSH
              </Text>
              <Text style={[styles.brandTitle, { color: labelStrong }]}>
                Match 3
              </Text>
            </View>
            <View style={{ alignItems: "flex-end" }}>
              <Text style={[styles.statLabel, { color: labelMuted }]}>goal</Text>
              <Text style={[styles.scoreBig, { color: labelStrong }]}>
                {score}
                <Text style={{ color: labelMuted, fontWeight: "700" }}>
                  {" "}
                  / {TARGET}
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
                const { x, y } = ensureAnim(tile.id);
                return (
                  <GemTile
                    key={tile.id}
                    gemIndex={tile.gem}
                    special={tile.special}
                    size={cell}
                    selected={sel?.r === row && sel.c === col}
                    dimmed={inputLocked}
                    warmth={scoreProgress}
                    slideX={x}
                    slideY={y}
                    onTap={() => onGemTap(row, col)}
                    onSwipe={(dr, dc) => onGemSwipe(row, col, dr, dc)}
                  />
                );
              })}
            </View>
          ))}
        </View>

        <View style={styles.powerRow}>
          <Pressable
            onPress={() =>
              setPMode((m) => (m === "hammer" ? "none" : "hammer"))
            }
            disabled={hammers <= 0 || inputLocked}
            style={({ pressed }) => [
              styles.powerChip,
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
            <View>
              <Text style={[styles.powerChipLabel, { color: labelStrong }]}>
                Hammer
              </Text>
              <Text style={[styles.powerChipCount, { color: labelMuted }]}>
                ×{hammers}
              </Text>
            </View>
          </Pressable>
        </View>

        <Text style={[styles.footerHint, { color: hintColor }]}>
          Match 4 in a line for a coin (swap it to clear a row). Match 5+ for a crown
          (swap onto a color to clear all of that gem). Drag or tap to swap.
        </Text>
      </View>

      <Modal visible={status === "won"} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <GlassCard padding={22} style={styles.modalCard} intensity={48}>
            <View style={styles.winPotRow}>
              <Image
                source={GOLD_POT_ASSET}
                style={{ width: 72, height: 72 }}
                contentFit="contain"
              />
              <Text style={[styles.winTitle, { color: labelStrong }]}>Level clear</Text>
              <Text style={[styles.winCoinsLine, { color: labelMuted }]}>
                +{lastWinCoins} coins
              </Text>
              <Text style={[styles.winTotalLine, { color: labelMuted }]}>
                Vault: {totalCoins} coins
              </Text>
            </View>
            <Pressable onPress={resetRound} style={[styles.modalBtnWrap, { marginTop: 8 }]}>
              <LinearGradient
                colors={[C.accent, "#ff6b35"]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.modalBtnGrad}
              >
                <Text style={styles.modalBtnText}>Play again</Text>
              </LinearGradient>
            </Pressable>
          </GlassCard>
        </View>
      </Modal>

      <Modal visible={status === "lost"} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <GlassCard padding={22} style={styles.modalCard} intensity={44}>
            <Text style={[styles.modalTitle, { color: labelStrong }]}>No moves left</Text>
            <Text style={[styles.modalBody, { color: labelMuted }]}>
              Try again — the board is reset and ready.
            </Text>
            <Pressable onPress={resetRound} style={styles.modalBtnWrap}>
              <LinearGradient
                colors={["#c4b5fd", "#a78bfa"]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.modalBtnGrad}
              >
                <Text style={[styles.modalBtnText, { color: "#1e1535" }]}>Try again</Text>
              </LinearGradient>
            </Pressable>
          </GlassCard>
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
    fontSize: 26,
    fontWeight: "900",
    letterSpacing: -0.8,
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
  powerRow: {
    marginTop: 18,
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "center",
    gap: 10,
  },
  powerChip: {
    minWidth: 200,
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: "rgba(255,255,255,0.2)",
    backgroundColor: "rgba(255,255,255,0.08)",
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    justifyContent: "center",
  },
  hammerIcon: {
    width: 44,
    height: 44,
  },
  powerChipOff: { opacity: 0.38 },
  powerChipOn: {
    borderColor: "rgba(255, 180, 120, 0.65)",
    backgroundColor: "rgba(255, 140, 80, 0.15)",
  },
  winPotRow: {
    alignItems: "center",
    marginBottom: 4,
  },
  winTitle: {
    marginTop: 10,
    fontSize: 22,
    fontWeight: "900",
  },
  winCoinsLine: {
    marginTop: 6,
    fontSize: 20,
    fontWeight: "800",
  },
  winTotalLine: {
    marginTop: 4,
    fontSize: 14,
    fontWeight: "600",
  },
  powerChipLabel: { fontSize: 13, fontWeight: "800" },
  powerChipCount: { marginTop: 2, fontSize: 11, fontWeight: "700" },
  footerHint: {
    marginTop: 18,
    textAlign: "center",
    fontSize: 12,
    lineHeight: 18,
    fontWeight: "500",
    paddingHorizontal: 8,
  },
  modalOverlay: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 24,
    backgroundColor: "rgba(6,4,14,0.55)",
  },
  modalCard: {
    width: "100%",
    maxWidth: 340,
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
});
