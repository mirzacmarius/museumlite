#!/usr/bin/env node
/**
 * Run the main Next.js app against the local QA backend (foreground).
 *
 *   bun run qa:app             port 3000
 *   QA_APP_PORT=3100 bun run qa:app
 *
 * Stop any previous app server first: a stale one on the same port causes a
 * /login redirect loop.
 */
import { join } from "node:path";
import { localOnlyEnv, readState, root, run } from "./lib.mjs";

const { state } = readState();
const port = process.env.QA_APP_PORT ?? "3000";

process.exit(
  run("bunx", ["next", "dev", "-p", port], {
    cwd: join(root, "apps/app"),
    env: localOnlyEnv({
      NEXT_PUBLIC_CONVEX_URL: state.url,
      NEXT_PUBLIC_CONVEX_SITE_URL: state.site,
      SKIP_ENV_VALIDATION: "1",
    }),
  }),
);
