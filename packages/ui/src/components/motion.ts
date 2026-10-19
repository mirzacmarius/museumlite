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
