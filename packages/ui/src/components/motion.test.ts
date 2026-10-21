import { readFileSync } from "node:fs";
import { spring } from "framer-motion";
import { describe, expect, it } from "vitest";
import {
  SPRING_EASING_CSS,
  springEasingCss,
} from "../../scripts/spring-easing";
import { SPRING, SPRING_SMOOTH } from "./motion";

const css = readFileSync(SPRING_EASING_CSS, "utf8");

function cssCurve(name: string) {
  const stops = css
    .match(new RegExp(`--ease-${name}: linear\\(([^)]*)\\);`))?.[1]
    ?.split(",")
    .map(Number);
  const duration = Number(
    css.match(new RegExp(`--transition-duration-${name}: (\\d+)ms;`))?.[1],
  );
  if (!stops || !duration) throw new Error(`--ease-${name} is missing`);
  const at = (ms: number) => {
    const position = (ms / duration) * (stops.length - 1);
    const index = Math.min(Math.floor(position), stops.length - 2);
    const from = stops[index] ?? 0;
    const to = stops[index + 1] ?? 1;
    return from + (to - from) * (position - index);
  };
  return { at, duration };
}

describe("spring easing tokens", () => {
  it("match the springs in motion.ts (run `bun run spring-easing` after changing them)", () => {
    expect(css).toBe(springEasingCss());
  });

  it.each([
    ["spring", SPRING],
    ["spring-smooth", SPRING_SMOOTH],
  ])("--ease-%s follows framer-motion's spring", (name, transition) => {
    const curve = cssCurve(name);
    const framer = spring({ keyframes: [0, 1], ...transition });
    for (let ms = 0; ms <= curve.duration; ms++) {
      expect(Math.abs(curve.at(ms) - framer.next(ms).value)).toBeLessThan(
        0.006,
      );
    }
    expect(framer.next(curve.duration).value).toBeCloseTo(1, 2);
  });
});
