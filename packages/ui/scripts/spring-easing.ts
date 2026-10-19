import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { SPRING, SPRING_SMOOTH } from "../src/components/motion";

interface Spring {
  stiffness: number;
  damping: number;
  mass: number;
}

const SPRINGS: Record<string, Spring> = {
  spring: SPRING,
  "spring-smooth": SPRING_SMOOTH,
};

const SETTLE_TOLERANCE = 0.001;
const SAMPLE_STEP_MS = 10;

export const SPRING_EASING_CSS = fileURLToPath(
  new URL("../src/spring-easing.css", import.meta.url),
);

/** Progress from 0 to 1 of a spring released at rest, `seconds` after release. */
export function springProgress(
  { stiffness, damping, mass }: Spring,
  seconds: number,
): number {
  const naturalFrequency = Math.sqrt(stiffness / mass);
  const dampingRatio = damping / (2 * Math.sqrt(stiffness * mass));
  const decay = Math.exp(-dampingRatio * naturalFrequency * seconds);
  if (dampingRatio === 1) {
    return 1 - decay * (1 + naturalFrequency * seconds);
  }
  if (dampingRatio > 1) {
    throw new Error("Overdamped springs are not supported");
  }
  const dampedFrequency =
    naturalFrequency * Math.sqrt(1 - dampingRatio * dampingRatio);
  return (
    1 -
    decay *
      (Math.cos(dampedFrequency * seconds) +
        ((dampingRatio * naturalFrequency) / dampedFrequency) *
          Math.sin(dampedFrequency * seconds))
  );
}

/** Milliseconds, in whole sample steps, until the spring stays within the tolerance of 1. */
export function settleMs(spring: Spring): number {
  let lastOutside = 0;
  for (let ms = 0; ms <= 5000; ms++) {
    if (Math.abs(1 - springProgress(spring, ms / 1000)) >= SETTLE_TOLERANCE) {
      lastOutside = ms;
    }
  }
  return Math.ceil((lastOutside + 1) / SAMPLE_STEP_MS) * SAMPLE_STEP_MS;
}

/** The spring as evenly spaced `linear()` stops over its settle duration. */
export function springStops(spring: Spring): number[] {
  const durationMs = settleMs(spring);
  const stops: number[] = [];
  for (let ms = 0; ms < durationMs; ms += SAMPLE_STEP_MS) {
    stops.push(Number(springProgress(spring, ms / 1000).toFixed(4)));
  }
  stops.push(1);
  return stops;
}

/** The stylesheet, laid out the way Biome formats it. */
export function springEasingCss(): string {
  const tokens = Object.entries(SPRINGS).flatMap(([name, spring]) => [
    `  --ease-${name}: linear(\n${springStops(spring)
      .map((stop) => `    ${stop}`)
      .join(",\n")}\n  );`,
    `  --transition-duration-${name}: ${settleMs(spring)}ms;`,
  ]);
  return `/* Generated from components/motion.ts by \`bun run spring-easing\`. */\n@theme {\n${tokens.join("\n")}\n}\n`;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  writeFileSync(SPRING_EASING_CSS, springEasingCss());
  for (const [name, spring] of Object.entries(SPRINGS)) {
    console.log(`--ease-${name}: ${settleMs(spring)}ms`);
  }
}
