import { type ReactNode, useRef, useState } from "react";
import {
  Animated,
  type GestureResponderEvent,
  type PanResponderGestureState,
  PanResponder,
  Platform,
  View,
} from "react-native";
import type { ColumnId } from "../shared/board";
import type { BoardCard } from "./use-boards";

type Rect = { x: number; y: number; width: number; height: number };
type Point = { x: number; y: number };
type Session = {
  card: BoardCard;
  pointer: Point;
  hover: ColumnId | null;
  targets: [ColumnId, Rect][];
  // Window position of the overlay's origin plus where on the card it was grabbed.
  offset: Point | null;
};

function measure(view: View | null | undefined): Promise<Rect | null> {
  return new Promise((resolve) => {
    if (!view) return resolve(null);
    view.measureInWindow((x, y, width, height) => resolve({ x, y, width, height }));
  });
}

const pointOf = (e: GestureResponderEvent): Point => ({ x: e.nativeEvent.pageX, y: e.nativeEvent.pageY });
const inside = (p: Point, r: Rect) => p.x >= r.x && p.x <= r.x + r.width && p.y >= r.y && p.y <= r.y + r.height;

export type CardDrag = ReturnType<typeof useCardDrag>;

// Drag a card onto another column (or column tab). There is no reordering:
// GitHub issues have no manual order, so a drop target is a column, not a slot.
export function useCardDrag(onDrop: (card: BoardCard, column: ColumnId) => void) {
  const rootRef = useRef<View>(null);
  const targets = useRef(new Map<ColumnId, View>()).current;
  const position = useRef(new Animated.ValueXY()).current;
  const session = useRef<Session | null>(null);
  const endedAt = useRef(0);
  const [dragging, setDragging] = useState<{ card: BoardCard; width: number } | null>(null);
  const [hover, setHover] = useState<ColumnId | null>(null);
  // Touch scrolls on drag, so there a long press arms the card first.
  const [armed, setArmed] = useState<string | null>(null);
  const latest = useRef({ onDrop, armed });
  latest.current = { onDrop, armed };

  const follow = (s: Session) => {
    if (!s.offset) return;
    position.setValue({ x: s.pointer.x - s.offset.x, y: s.pointer.y - s.offset.y });
    const next = s.targets.find(([, rect]) => inside(s.pointer, rect))?.[0] ?? null;
    if (next !== s.hover) {
      s.hover = next;
      setHover(next);
    }
  };

  return {
    rootRef,
    position,
    dragging,
    hover,
    active: !!armed || !!dragging,
    target: (column: ColumnId) => (view: View | null) => {
      if (view) targets.set(column, view);
      else targets.delete(column);
    },
    arm: Platform.OS === "web" ? undefined : (key: string) => setArmed(key),
    disarm: () => setArmed(null),
    // Browsers can fire a click on the source card when a drag is released over it.
    justDropped: () => Date.now() - endedAt.current < 300,
    shouldStart(card: BoardCard, gesture: PanResponderGestureState) {
      if (session.current) return false;
      return Platform.OS === "web" ? Math.hypot(gesture.dx, gesture.dy) > 6 : latest.current.armed === card.key;
    },
    async start(card: BoardCard, tile: View | null, e: GestureResponderEvent) {
      const s: Session = { card, pointer: pointOf(e), hover: null, targets: [], offset: null };
      const grabbedAt = s.pointer;
      session.current = s;
      const [root, rect, ...rects] = await Promise.all([
        measure(rootRef.current),
        measure(tile),
        ...[...targets].map(async ([id, view]) => [id, await measure(view)] as const),
      ]);
      if (session.current !== s || !root || !rect) return;
      s.targets = rects.flatMap(([id, r]) => (r ? [[id, r] as [ColumnId, Rect]] : []));
      s.offset = { x: root.x + grabbedAt.x - rect.x, y: root.y + grabbedAt.y - rect.y };
      follow(s);
      setDragging({ card, width: rect.width });
    },
    move(e: GestureResponderEvent) {
      const s = session.current;
      if (!s) return;
      s.pointer = pointOf(e);
      follow(s);
    },
    end(commit: boolean) {
      const s = session.current;
      session.current = null;
      if (s) endedAt.current = Date.now();
      if (commit && s?.hover && s.hover !== s.card.column) latest.current.onDrop(s.card, s.hover);
      setDragging(null);
      setHover(null);
      setArmed(null);
    },
  };
}

// Wraps a card tile. Taps still reach the tile's Pressable; the wrapper only
// captures the gesture once it becomes a drag.
export function Draggable({ drag, card, children }: { drag: CardDrag; card: BoardCard; children: ReactNode }) {
  const ref = useRef<View>(null);
  const latest = useRef({ drag, card });
  latest.current = { drag, card };
  const responder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponderCapture: (_e, gesture) => latest.current.drag.shouldStart(latest.current.card, gesture),
      onPanResponderGrant: (e) => void latest.current.drag.start(latest.current.card, ref.current, e),
      onPanResponderMove: (e) => latest.current.drag.move(e),
      onPanResponderRelease: () => latest.current.drag.end(true),
      onPanResponderTerminate: () => latest.current.drag.end(false),
      onPanResponderTerminationRequest: () => false,
    }),
  ).current;
  const lifted = drag.dragging?.card.key === card.key;
  return (
    <View ref={ref} {...responder.panHandlers} style={{ opacity: lifted ? 0.35 : 1 }}>
      {children}
    </View>
  );
}

// The card under the pointer. Render it last inside the element that owns rootRef.
export function DragOverlay({ drag, children }: { drag: CardDrag; children(card: BoardCard): ReactNode }) {
  if (!drag.dragging) return null;
  return (
    <Animated.View
      style={{
        position: "absolute",
        left: 0,
        top: 0,
        width: drag.dragging.width,
        pointerEvents: "none",
        transform: [...drag.position.getTranslateTransform(), { rotate: "2deg" }],
      }}
    >
      {children(drag.dragging.card)}
    </Animated.View>
  );
}
