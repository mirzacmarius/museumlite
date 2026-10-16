#!/usr/bin/env node
/**
 *   node scripts/perf/measure-navigation.mjs --label baseline [--runs 7] [--latency 100] [--url http://localhost:3122]
 *
 * See scripts/perf/README.md for setup and what each column means.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { cpus, loadavg } from "node:os";
import { join } from "node:path";
import { parseArgs } from "node:util";
import { chromium } from "playwright";
import { qaStorageState, root } from "../local-qa/lib.mjs";
import {
  PERF_ACCESSION_SOURCE,
  PERF_GROUP_NAME,
  PERF_OBJECT_PREFIX,
} from "./fixtures.mjs";

const { values: options } = parseArgs({
  options: {
    label: { type: "string" },
    runs: { type: "string", default: "7" },
    url: { type: "string", default: "http://localhost:3122" },
    headed: { type: "boolean", default: false },
    latency: { type: "string", default: "0" },
  },
});
if (!options.label) {
  console.error("✗ --label is required (for example --label baseline)");
  process.exit(1);
}
const runs = Number(options.runs);
const latencyMs = Number(options.latency);
if (!Number.isInteger(runs) || runs < 1) {
  console.error(`✗ --runs must be a positive integer, got ${options.runs}`);
  process.exit(1);
}
if (!Number.isFinite(latencyMs) || latencyMs < 0) {
  console.error(`✗ --latency must be milliseconds, got ${options.latency}`);
  process.exit(1);
}
const baseUrl = options.url.replace(/\/$/, "");
const outDir = join(root, ".local-qa/perf");
const HAND_MADE_SKELETON_CLASSES = [
  "animate-pulse",
  "bg-muted/60",
  "bg-muted/50",
  "bg-muted/40",
];
const IDLE_PREFETCH_WINDOW_MS = 3000;
const STEP_TIMEOUT_MS = 20000;

const steps = [
  {
    name: "overview -> objects",
    link: 'a[href="/objects"]',
    path: "/objects",
    readySource:
      "main.querySelector('tbody tr a[href^=\"/objects/\"]') !== null",
  },
  {
    name: "objects -> object detail",
    link: 'tbody tr a[href^="/objects/"]',
    path: "/objects/",
    readySource: `main.querySelector("tbody") === null && /${PERF_OBJECT_PREFIX} \\d\\d/.test(main.textContent ?? "")`,
  },
  {
    name: "object detail -> accessions",
    link: 'a[href="/accessions"]',
    path: "/accessions",
    readySource: `/${PERF_ACCESSION_SOURCE} \\d/.test(main.textContent ?? "")`,
  },
  {
    name: "accessions -> transfers",
    link: 'a[href="/accessions/transfers"]',
    path: "/accessions/transfers",
    readySource:
      '(main.textContent ?? "").includes("Pending transfer approval")',
  },
  {
    name: "transfers -> administration",
    link: 'a[href="/settings/organization"]',
    path: "/settings/organization",
    readySource: "main.querySelector('input[value=\"QA Museum\"]') !== null",
  },
  {
    name: "administration -> modules",
    link: 'a[href="/settings/modules"]',
    path: "/settings/modules",
    readySource: "main.querySelector('button[role=\"switch\"]') !== null",
  },
  {
    name: "modules -> overview",
    link: 'a[href="/"]',
    path: "/",
    readySource: `(main.textContent ?? "").includes("${PERF_GROUP_NAME}")`,
  },
];

const recorderSource = `
(() => {
  const skeletonSelector = ['[data-slot="skeleton"]', ...${JSON.stringify(HAND_MADE_SKELETON_CLASSES)}.map((token) => "." + CSS.escape(token))].join(", ");
  const hasSkeleton = (root) => root.querySelector(skeletonSelector) !== null;
  const nav = { active: null };
  const matchesPath = (pathname, path) =>
    pathname === path || (path.endsWith("/") ? pathname.startsWith(path) : pathname.startsWith(path + "/"));
  const wrap = (name) => {
    const original = history[name];
    history[name] = function (...args) {
      const at = performance.now();
      const result = original.apply(this, args);
      const active = nav.active;
      if (active && active.clickAt !== null && active.urlChange === null && matchesPath(location.pathname, active.path)) {
        active.urlChange = at;
      }
      return result;
    };
  };
  wrap("pushState");
  wrap("replaceState");
  document.addEventListener(
    "click",
    () => {
      if (nav.active && nav.active.clickAt === null) nav.active.clickAt = performance.now();
    },
    true,
  );
  const main = () => document.getElementById("main-content");
  const observer = new MutationObserver((records) => {
    const active = nav.active;
    if (!active || active.clickAt === null) return;
    const now = performance.now();
    const container = main();
    if (!container) return;
    if (active.firstShell === null) {
      for (const record of records) {
        if (container.contains(record.target)) { active.firstShell = now; break; }
      }
    }
    if (active.ready === null && active.urlChange !== null) {
      let ok = false;
      try { ok = active.predicate(container); } catch { ok = false; }
      if (ok && !hasSkeleton(container)) active.ready = now;
    }
  });
  observer.observe(document, { childList: true, subtree: true, characterData: true, attributes: true });
  window.__nav = {
    start(path, predicateSource) {
      nav.active = {
        path,
        predicate: new Function("main", "return (" + predicateSource + ");"),
        clickAt: null,
        urlChange: null,
        firstShell: null,
        ready: null,
      };
    },
    result() {
      const a = nav.active;
      if (!a || a.clickAt === null) return null;
      const rel = (t) => (t === null ? null : Math.round((t - a.clickAt) * 10) / 10);
      return { urlChange: rel(a.urlChange), firstShell: rel(a.firstShell), ready: rel(a.ready) };
    },
    settled() {
      const container = main();
      return container !== null && !hasSkeleton(container);
    },
  };
})();
`;

function isPrefetch(request) {
  const headers = request.headers();
  return (
    headers["next-router-prefetch"] === "1" ||
    headers.purpose === "prefetch" ||
    headers["sec-purpose"] === "prefetch"
  );
}

async function expandSidebarGroups(page) {
  const closedTrigger =
    '[data-sidebar="sidebar"] button[aria-expanded="false"][aria-controls]';
  await page.evaluate((selector) => {
    for (const trigger of document.querySelectorAll(selector)) trigger.click();
  }, closedTrigger);
  await page.waitForFunction(
    (selector) => document.querySelectorAll(selector).length === 0,
    closedTrigger,
    { timeout: STEP_TIMEOUT_MS },
  );
}

async function measureRun(browser, storageState, runIndex) {
  const context = await browser.newContext({
    storageState,
    viewport: { width: 1440, height: 1600 },
  });
  await context.addInitScript(recorderSource);
  const page = await context.newPage();
  if (latencyMs > 0) {
    const cdp = await context.newCDPSession(page);
    await cdp.send("Network.enable");
    await cdp.send("Network.emulateNetworkConditions", {
      offline: false,
      latency: latencyMs,
      downloadThroughput: -1,
      uploadThroughput: -1,
    });
  }
  const prefetches = { overview: 0, objects: 0, total: 0 };
  let idleBucket = null;
  page.on("request", (request) => {
    if (!isPrefetch(request)) return;
    prefetches.total += 1;
    if (idleBucket) prefetches[idleBucket] += 1;
  });
  const idle = async (bucket) => {
    idleBucket = bucket;
    await page.waitForTimeout(IDLE_PREFETCH_WINDOW_MS);
    idleBucket = null;
  };

  const coldLoadStart = Date.now();
  await page.goto(`${baseUrl}/`, { waitUntil: "load" });
  await page.waitForFunction(
    (groupName) =>
      window.__nav.settled() && document.body.textContent.includes(groupName),
    PERF_GROUP_NAME,
    { timeout: STEP_TIMEOUT_MS },
  );
  const coldLoadMs = Date.now() - coldLoadStart;
  await expandSidebarGroups(page);
  await idle("overview");

  const results = [];
  for (const step of steps) {
    const link = page.locator(step.link).locator("visible=true").first();
    await link.waitFor({ state: "visible", timeout: STEP_TIMEOUT_MS });
    await page.evaluate(
      ([path, predicate]) => window.__nav.start(path, predicate),
      [step.path, step.readySource],
    );
    await link.hover();
    await link.click();
    let timedOut = false;
    try {
      await page.waitForFunction(
        () => window.__nav.result()?.ready !== null,
        null,
        { timeout: STEP_TIMEOUT_MS },
      );
    } catch {
      timedOut = true;
    }
    const timings = await page.evaluate(() => window.__nav.result());
    results.push({ step: step.name, path: step.path, timedOut, ...timings });
    if (step.path === "/objects") await idle("objects");
  }
  await context.close();
  return { run: runIndex, coldLoadMs, prefetches, steps: results };
}

function percentile(values, fraction) {
  const sorted = values.filter((value) => value !== null).sort((a, b) => a - b);
  if (sorted.length === 0) return null;
  const index = Math.min(
    sorted.length - 1,
    Math.ceil(fraction * sorted.length) - 1,
  );
  return sorted[Math.max(0, index)];
}

function summarize(measured) {
  const summary = [];
  for (const [index, step] of steps.entries()) {
    const rows = measured.map((run) => run.steps[index]);
    const entry = {
      step: step.name,
      path: step.path,
      timedOut: rows.filter((r) => r.timedOut).length,
    };
    for (const metric of ["urlChange", "firstShell", "ready"]) {
      const values = rows.map((row) => row[metric]);
      entry[metric] = {
        median: percentile(values, 0.5),
        p90: percentile(values, 0.9),
        n: values.filter((v) => v !== null).length,
      };
    }
    summary.push(entry);
  }
  const prefetch = {};
  for (const bucket of ["overview", "objects", "total"]) {
    prefetch[bucket] = percentile(
      measured.map((run) => run.prefetches[bucket]),
      0.5,
    );
  }
  return {
    steps: summary,
    prefetchMedian: prefetch,
    coldLoadMedianMs: percentile(
      measured.map((r) => r.coldLoadMs),
      0.5,
    ),
  };
}

mkdirSync(outDir, { recursive: true });
const { storageState } = await qaStorageState(baseUrl);
const browser = await chromium.launch({ headless: !options.headed });
const loadBefore = loadavg();
console.log(`Warm-up run against ${baseUrl}`);
await measureRun(browser, storageState, 0);
const measured = [];
for (let run = 1; run <= runs; run++) {
  const result = await measureRun(browser, storageState, run);
  measured.push(result);
  console.log(
    `run ${run}: ${result.steps.map((s) => `${s.ready ?? "x"}`).join(" ")} ms ready; prefetches ${result.prefetches.total}`,
  );
}
await browser.close();

const report = {
  label: options.label,
  url: baseUrl,
  latencyMs,
  recordedAt: new Date().toISOString(),
  machine: {
    cpu: cpus()[0]?.model,
    cores: cpus().length,
    loadBefore,
    loadAfter: loadavg(),
  },
  runs,
  summary: summarize(measured),
  measured,
};
const file = join(
  outDir,
  `${options.label}-${report.recordedAt.replace(/[:.]/g, "-")}.json`,
);
writeFileSync(file, JSON.stringify(report, null, 2));
console.log(`\n${options.label}: median / p90 ms after click (n=${runs})`);
console.log(
  "step".padEnd(34),
  "urlChange".padEnd(16),
  "firstShell".padEnd(16),
  "ready".padEnd(16),
  "timeouts",
);
for (const row of report.summary.steps) {
  const cell = (m) => `${m.median ?? "-"} / ${m.p90 ?? "-"}`.padEnd(16);
  console.log(
    row.step.padEnd(34),
    cell(row.urlChange),
    cell(row.firstShell),
    cell(row.ready),
    row.timedOut,
  );
}
console.log(
  `prefetch requests while idle (median): overview ${report.summary.prefetchMedian.overview}, objects ${report.summary.prefetchMedian.objects}; whole run ${report.summary.prefetchMedian.total}`,
);
console.log(`cold load of / (median): ${report.summary.coldLoadMedianMs} ms`);
console.log(`wrote ${file}`);
