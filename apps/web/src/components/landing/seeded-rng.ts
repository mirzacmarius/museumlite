export function seededRandom(seed: number): number {
  // Mulberry32 PRNG using 32-bit integer math.
  // This avoids SSR/client float/string drift that can happen with Math.sin/Math.random.
  let a = seed >>> 0;
  a = (a + 0x6d2b79f5) >>> 0;

  let t = Math.imul(a ^ (a >>> 15), a | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);

  // Convert uint32 -> [0, 1)
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}
