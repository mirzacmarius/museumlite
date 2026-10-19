import { type CSSProperties, type Key, useEffect, useRef } from "react";
import { ENTRY_MOTION } from "../components/motion";

const STAGGER_MS = 35;
const STAGGERED_ITEMS = 10;

/**
 * Entry motion for a list's items. The items of the list's first render with
 * items fade and rise in one after another, 35ms apart and at most 315ms
 * late. Items that arrive later, through a live update or another page, fade
 * in at once on their own, and an item keeps its delay across re-renders, so
 * nothing already shown replays.
 */
export function useStaggeredEntry() {
  const delays = useRef(new Map<Key, number>());
  const settled = useRef(false);
  useEffect(() => {
    if (delays.current.size > 0) settled.current = true;
  });
  return (key: Key, index: number) => {
    let delay = delays.current.get(key);
    if (delay === undefined) {
      delay = settled.current
        ? 0
        : Math.min(index, STAGGERED_ITEMS - 1) * STAGGER_MS;
      delays.current.set(key, delay);
    }
    const style: CSSProperties = { animationDelay: `${delay}ms` };
    return { className: ENTRY_MOTION, style };
  };
}
