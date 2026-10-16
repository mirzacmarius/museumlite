import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const script = fileURLToPath(new URL("./compare.mjs", import.meta.url));
const timing = { median: 0, p90: 0, n: 1 };
const report = {
  label: "fixture",
  recordedAt: "2026-10-16T00:00:00Z",
  runs: 1,
  machine: { loadBefore: [0, 0, 0] },
  summary: {
    steps: [
      {
        step: "modules -> overview",
        timedOut: 0,
        urlChange: timing,
        firstShell: timing,
        ready: timing,
      },
    ],
    prefetchMedian: { overview: 0, objects: 0, total: 0 },
    coldLoadMedianMs: 0,
  },
};

function compare(before, after) {
  const dir = mkdtempSync(join(tmpdir(), "museumlite-perf-test-"));
  try {
    const paths = [before, after].map((value, index) => {
      const path = join(dir, `${index}.json`);
      writeFileSync(path, JSON.stringify(value));
      return path;
    });
    return spawnSync(process.execPath, [script, ...paths], {
      encoding: "utf8",
    });
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

test("compares complete reports, including zero timings", () => {
  const result = compare(report, report);
  assert.equal(result.status, 0, result.stderr);
  assert.doesNotMatch(result.stdout, /NaN|undefined/);
});

for (const side of ["before", "after"]) {
  for (const defect of ["missing timing", "timeout", "missing sample"]) {
    test(`refuses ${side} report with ${defect}`, () => {
      const invalid = structuredClone(report);
      const row = invalid.summary.steps[0];
      if (defect === "missing timing") delete row.ready.median;
      if (defect === "timeout") row.timedOut = 1;
      if (defect === "missing sample") row.ready.n = 0;
      const result = compare(
        side === "before" ? invalid : report,
        side === "after" ? invalid : report,
      );
      assert.notEqual(result.status, 0, "invalid report was accepted");
      assert.match(result.stderr, /invalid|incomplete|timeout/i);
      assert.doesNotMatch(result.stdout, /NaN|undefined/);
    });
  }
}
