import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { config } from "dotenv";

/**
 * Load env files from the monorepo root, then app-local overrides.
 * Call from next.config.mjs or env.mjs so worktrees can use a single root .env.local.
 */
export function loadMonorepoEnv(fromModuleUrl) {
  const startDir = dirname(fileURLToPath(fromModuleUrl));
  let root = startDir;

  while (root !== dirname(root)) {
    if (existsSync(join(root, "turbo.json"))) break;
    root = dirname(root);
  }

  const layers = [
    join(root, ".env"),
    join(root, ".env.local"),
    join(startDir, ".env"),
    join(startDir, ".env.local"),
  ];

  for (const path of layers) {
    if (existsSync(path)) {
      config({ path, override: false });
    }
  }
}
