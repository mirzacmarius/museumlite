#!/usr/bin/env node
/**
 * Run the main Next.js app against the local QA backend (foreground).
 *
 *   bun run qa:app             dev server on port 3000
 *   QA_APP_PORT=3100 bun run qa:app
 *   bun run qa:app -- --build  production build, then `next start`
 *
 * Stop any previous app server first: a stale one on the same port causes a
 * /login redirect loop. The production build writes to apps/app/.next/local-qa
 * so it never collides with a cloud-pointed build in the same checkout.
 */
import { join } from "node:path";
import { localOnlyEnv, readState, root, run } from "./lib.mjs";

const { state } = readState();
const port = process.env.QA_APP_PORT ?? "3000";
const production = process.argv.includes("--build");
const options = {
  cwd: join(root, "apps/app"),
  env: localOnlyEnv({
    NEXT_PUBLIC_CONVEX_URL: state.url,
    NEXT_PUBLIC_CONVEX_SITE_URL: state.site,
    SKIP_ENV_VALIDATION: "1",
    ...(production ? { LOCAL_QA: "1", SENTRY_AUTH_TOKEN: "" } : {}),
  }),
};

if (production) {
  const built = run("bunx", ["next", "build"], options);
  if (built !== 0) process.exit(built);
  process.exit(run("bunx", ["next", "start", "-p", port], options));
}

process.exit(run("bunx", ["next", "dev", "-p", port], options));
