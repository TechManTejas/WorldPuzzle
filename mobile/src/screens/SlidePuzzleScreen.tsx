import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
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
  indexToRC,
  isSolved,
  rcToIndex,
  shuffleBoard,
  tryMove,
} from "../game/slidePuzzle";

const PUZZLE_IMAGE = require("../../assets/download.webp");

const GRID_N = 4;
const SWIPE_MIN = 18;

export function SlidePuzzleScreen() {
  const insets = useSafeAreaInsets();
  const { width: winW } = useWindowDimensions();

  const boardPx = Math.min(winW - 32, 360);
  const cell = boardPx / GRID_N;

  const [board, setBoard] = useState<number[]>(() => shuffleBoard(GRID_N));
  const [moves, setMoves] = useState(0);
  const [won, setWon] = useState(false);
  const wonRef = useRef(won);
  useEffect(() => {
    wonRef.current = won;
  }, [won]);

  const boardRef = useRef(board);
  useEffect(() => {
    boardRef.current = board;
  }, [board]);

  const trySlide = useCallback((tileIdx: number) => {
    if (wonRef.current) return;
    const next = tryMove(boardRef.current, GRID_N, tileIdx);
    if (!next) return;
    setBoard(next);
    setMoves((m) => m + 1);
    if (isSolved(next, GRID_N)) setWon(true);
  }, []);

  const newGame = useCallback(() => {
    setBoard(shuffleBoard(GRID_N));
    setMoves(0);
    setWon(false);
  }, []);

  const makeTilePan = useCallback(
    (idx: number) =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onPanResponderRelease: (_, g) => {
          const dx = g.dx;
          const dy = g.dy;
          const dist = Math.hypot(dx, dy);
          const b = boardRef.current;
          if (dist < SWIPE_MIN) {
            trySlide(idx);
            return;
          }
          const { r, c } = indexToRC(idx, GRID_N);
          let tr = r;
          let tc = c;
          if (Math.abs(dx) >= Math.abs(dy)) {
            tc += dx > 0 ? 1 : -1;
          } else {
            tr += dy > 0 ? 1 : -1;
          }
          if (tr < 0 || tr >= GRID_N || tc < 0 || tc >= GRID_N) return;
          const neighbor = rcToIndex(tr, tc, GRID_N);
          if (b[neighbor] === -1) trySlide(idx);
        },
      }),
    [trySlide]
  );

  const panRefs = useRef<Record<number, ReturnType<typeof PanResponder.create>>>(
    {}
  );
  const getPan = (idx: number) => {
    if (!panRefs.current[idx]) panRefs.current[idx] = makeTilePan(idx);
    return panRefs.current[idx];
  };

  return (
    <View style={[styles.root, { paddingTop: insets.top + 12 }]}>
      <LinearGradient
        colors={["#0a0812", "#15102a", "#1a1530"]}
        style={StyleSheet.absoluteFill}
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0.5, y: 1 }}
      />

      <View style={styles.header}>
        <Text style={styles.title}>Tile puzzle</Text>
        <Text style={styles.sub}>Tap or swipe a tile toward the empty space</Text>
        <View style={styles.metaRow}>
          <Text style={styles.meta}>Moves: {moves}</Text>
          <Pressable onPress={newGame} style={styles.newBtn}>
            <Text style={styles.newBtnTxt}>New game</Text>
          </Pressable>
        </View>
      </View>

      <View style={[styles.boardWrap, { width: boardPx, height: boardPx }]}>
        {board.map((piece, idx) => {
          const { r: gr, c: gc } = indexToRC(idx, GRID_N);
          const left = gc * cell;
          const top = gr * cell;
          if (piece === -1) {
            return (
              <View
                key={`e-${idx}`}
                style={[
                  styles.cell,
                  { width: cell, height: cell, left, top },
                  styles.emptyCell,
                ]}
              />
            );
          }
          const { r: pr, c: pc } = indexToRC(piece, GRID_N);
          return (
            <View
              key={`p-${piece}-${idx}`}
              style={[styles.cell, { width: cell, height: cell, left, top }]}
              {...getPan(idx).panHandlers}
            >
              <View style={[styles.sliceMask, { width: cell, height: cell }]}>
                <Image
                  source={PUZZLE_IMAGE}
                  style={{
                    position: "absolute",
                    width: boardPx,
                    height: boardPx,
                    left: -pc * cell,
                    top: -pr * cell,
                  }}
                  contentFit="fill"
                />
              </View>
            </View>
          );
        })}
      </View>

      <Modal visible={won} transparent animationType="fade">
        <View style={styles.modalBg}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Complete</Text>
            <Text style={styles.modalBody}>
              Image restored in {moves} moves.
            </Text>
            <Pressable
              onPress={newGame}
              style={({ pressed }) => [styles.modalBtn, pressed && { opacity: 0.9 }]}
            >
              <LinearGradient
                colors={["#6366f1", "#4f46e5"]}
                style={styles.modalBtnGrad}
              >
                <Text style={styles.modalBtnTxt}>Play again</Text>
              </LinearGradient>
            </Pressable>
          </View>
        </View>
      </Modal>

      <View style={{ height: insets.bottom + 12 }} />
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    alignItems: "center",
  },
  header: {
    paddingHorizontal: 20,
    marginBottom: 20,
    width: "100%",
    alignItems: "center",
  },
  title: {
    fontSize: 26,
    fontWeight: "900",
    color: "rgba(255,248,242,0.96)",
    letterSpacing: -0.5,
  },
  sub: {
    marginTop: 6,
    fontSize: 14,
    color: "rgba(255,230,220,0.55)",
    textAlign: "center",
  },
  metaRow: {
    marginTop: 16,
    flexDirection: "row",
    alignItems: "center",
    gap: 16,
  },
  meta: {
    fontSize: 15,
    fontWeight: "700",
    color: "rgba(255,248,242,0.85)",
    fontVariant: ["tabular-nums"],
  },
  newBtn: {
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 12,
    backgroundColor: "rgba(255,255,255,0.1)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.18)",
  },
  newBtnTxt: {
    fontSize: 14,
    fontWeight: "800",
    color: "rgba(255,248,242,0.95)",
  },
  boardWrap: {
    position: "relative",
    borderRadius: 8,
    overflow: "hidden",
    borderWidth: 2,
    borderColor: "rgba(255,255,255,0.15)",
    backgroundColor: "#0d0b14",
  },
  cell: {
    position: "absolute",
  },
  emptyCell: {
    backgroundColor: "rgba(20,18,32,0.95)",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(255,255,255,0.08)",
  },
  sliceMask: {
    overflow: "hidden",
    borderRadius: 2,
  },
  modalBg: {
    flex: 1,
    backgroundColor: "rgba(6,4,14,0.72)",
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
  },
  modalCard: {
    width: "100%",
    maxWidth: 320,
    padding: 24,
    borderRadius: 18,
    backgroundColor: "rgba(28,24,48,0.98)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
  },
  modalTitle: {
    fontSize: 22,
    fontWeight: "900",
    color: "rgba(255,248,242,0.96)",
    textAlign: "center",
  },
  modalBody: {
    marginTop: 10,
    fontSize: 15,
    color: "rgba(255,230,220,0.65)",
    textAlign: "center",
  },
  modalBtn: {
    marginTop: 20,
    borderRadius: 14,
    overflow: "hidden",
  },
  modalBtnGrad: {
    paddingVertical: 14,
    alignItems: "center",
  },
  modalBtnTxt: {
    fontSize: 16,
    fontWeight: "800",
    color: "#fff",
  },
});
