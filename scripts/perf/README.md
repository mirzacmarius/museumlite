# Navigation benchmark

Measures client navigations in a production build of the app against the local QA backend, with a signed-in QA user. Use it to compare two builds, for example before and after a routing or caching change.

## Run it

Ports below match the convention in `scripts/local-qa/README.md`. Pick others if these are taken.

```bash
QA_PORT=3251 QA_APP_PORT=3122 bun run qa:backend
QA_PORT=3251 bun run convex:local -- deploy --yes
QA_PORT=3251 QA_APP_PORT=3122 bun run qa:seed
QA_PORT=3251 node scripts/perf/seed-perf-data.mjs      # 1 group, 40 objects, 5 accessions
bun install --cwd scripts/perf                          # Playwright, outside the workspace graph
QA_APP_PORT=3122 bun run qa:app -- --build              # next build, then next start
node scripts/perf/measure-navigation.mjs --label before --runs 7
node scripts/perf/measure-navigation.mjs --label before-rtt100 --runs 7 --latency 100
```

Rebuild with the change, start it on the same port, run the script again with another label, then compare:

```bash
node scripts/perf/compare.mjs .local-qa/perf/before-*.json .local-qa/perf/after-*.json
```

Playwright needs a Chromium download once: `bunx --cwd scripts/perf playwright install chromium`.

## What a run measures

The script signs the QA user in itself (one fresh session per invocation). Each run opens a fresh browser context (empty router cache, warm server), loads `/`, expands every sidebar group, then clicks through Overview, Objects, an object, Accessions, Transfers, Administration, Modules, and back to Overview. For each click it records, in milliseconds after the page's `click` event:

- `urlChange`: the `history.pushState` for the destination.
- `firstShell`: the first DOM mutation inside `#main-content`, whether loading UI or content.
- `ready`: the route's ready predicate holds and no skeleton class remains in `#main-content`.

It also counts requests carrying `Next-Router-Prefetch: 1` while the Overview and Objects pages sit idle for three seconds, and the time to a settled Overview on a cold load.

`--latency <ms>` adds a fixed round-trip delay through Chrome's network emulation. Loopback hides the server round trip that production users pay, so report both 0 ms and a production-like value.

The report prints median and p90 over `--runs` runs after one warm-up run, and writes the raw runs, load averages, and CPU model to `.local-qa/perf/<label>-<timestamp>.json`.

## Reading the numbers

- A gap smaller than the spread between runs is no difference. Look at p90 as well as the median.
- `ready` depends on the Convex websocket as much as on Next.js. A step whose `ready` does not move while `firstShell` does was waiting on data, not on routing.
- `timeouts` counts steps whose ready predicate never held within 20 seconds. A non-zero count means the predicate or the page broke. Fix that before trusting the row.
