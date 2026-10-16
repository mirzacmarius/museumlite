#!/usr/bin/env node
/**
 * Compare two reports from measure-navigation.mjs step by step.
 *
 *   node scripts/perf/compare.mjs .local-qa/perf/baseline-*.json .local-qa/perf/after-*.json
 */
import { readFileSync } from "node:fs";

const [beforePath, afterPath] = process.argv.slice(2);
if (!beforePath || !afterPath) {
  console.error("usage: compare.mjs <before.json> <after.json>");
  process.exit(1);
}
const before = JSON.parse(readFileSync(beforePath, "utf8"));
const after = JSON.parse(readFileSync(afterPath, "utf8"));

const delta = (a, b) => {
  if (a === null || b === null) return "n/a";
  const change = b - a;
  const pct =
    a === 0
      ? ""
      : ` (${change > 0 ? "+" : ""}${Math.round((change / a) * 100)}%)`;
  return `${change > 0 ? "+" : ""}${Math.round(change)}${pct}`;
};

console.log(`before: ${before.label} (${before.recordedAt}, n=${before.runs})`);
console.log(`after:  ${after.label} (${after.recordedAt}, n=${after.runs})`);
console.log(
  `load avg before/after measuring: ${before.machine.loadBefore.map((n) => n.toFixed(1))} -> ${after.machine.loadBefore.map((n) => n.toFixed(1))}\n`,
);
for (const metric of ["urlChange", "firstShell", "ready"]) {
  console.log(`${metric} median ms (before -> after, delta); p90 in brackets`);
  for (const [index, row] of before.summary.steps.entries()) {
    const next = after.summary.steps[index];
    if (!next || next.step !== row.step) {
      console.log(`  ${row.step}: step mismatch`);
      continue;
    }
    const a = row[metric];
    const b = next[metric];
    console.log(
      `  ${row.step.padEnd(32)} ${String(a.median).padStart(7)} -> ${String(b.median).padStart(7)}  ${delta(a.median, b.median).padEnd(14)} [${a.p90} -> ${b.p90}]${next.timedOut ? `  timeouts ${next.timedOut}` : ""}`,
    );
  }
  console.log();
}
console.log(
  `prefetch requests (median per run): overview ${before.summary.prefetchMedian.overview} -> ${after.summary.prefetchMedian.overview}, objects ${before.summary.prefetchMedian.objects} -> ${after.summary.prefetchMedian.objects}, whole run ${before.summary.prefetchMedian.total} -> ${after.summary.prefetchMedian.total}`,
);
console.log(
  `cold load of / (median ms): ${before.summary.coldLoadMedianMs} -> ${after.summary.coldLoadMedianMs}`,
);
