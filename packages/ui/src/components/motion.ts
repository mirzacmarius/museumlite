import type { Transition } from "framer-motion";

/**
 * Animate UI's spring, with a slight overshoot. CSS animations get the same
 * curve from `ease-spring duration-spring`, which
 * `scripts/spring-easing.ts` generates from these numbers.
 */
export const SPRING = {
  type: "spring",
  stiffness: 400,
  damping: 29,
  mass: 1,
} as const satisfies Transition;

/**
 * Critically damped, so a panel sliding in from a screen edge never
 * overshoots past it. CSS: `ease-spring-smooth duration-spring-smooth`.
 */
export const SPRING_SMOOTH = {
  type: "spring",
  stiffness: 400,
  damping: 40,
  mass: 1,
} as const satisfies Transition;

/**
 * A menu or card that opens on `data-state`: it springs out of its trigger
 * and leaves quickly. Pair it with the primitive's transform origin.
 */
export const FLOATING_MOTION =
  "data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-80 data-[state=open]:ease-spring data-[state=open]:duration-spring data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-80 data-[state=closed]:ease-in data-[state=closed]:duration-150";

/** A dialog grows in on the spring and leaves quickly, like a floating surface. */
export const DIALOG_MOTION =
  "data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-90 data-[state=open]:slide-in-from-bottom-2 data-[state=open]:ease-spring data-[state=open]:duration-spring data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-90 data-[state=closed]:slide-out-to-bottom-2 data-[state=closed]:ease-in data-[state=closed]:duration-150";

export const OVERLAY_MOTION =
  "duration-200 ease-out data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=closed]:animate-out data-[state=closed]:fade-out-0";
