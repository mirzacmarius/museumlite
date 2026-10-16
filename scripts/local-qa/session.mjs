#!/usr/bin/env node
/**
 * Print how to get a signed-in browser session for the seeded QA user, and
 * write fresh auth cookies as a Playwright storage state for when the login
 * page cannot be driven directly. Run after `bun run qa:seed`.
 *
 *   bun run qa:session
 *
 * Writes .local-qa/storage-state.json (gitignored, mode 0600). Nothing here
 * touches a cloud deployment.
 */
import { chmodSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { qaAppUrl, qaStorageState, stateDir } from "./lib.mjs";

const appUrl = qaAppUrl();
const { email, storageState } = await qaStorageState(appUrl);
const storageStatePath = join(stateDir, "storage-state.json");
writeFileSync(storageStatePath, JSON.stringify(storageState, null, 2));
chmodSync(storageStatePath, 0o600);

console.log(`Signed-in browser session for ${email} on ${appUrl}:

1. Login page: open ${appUrl}/en/login and sign in with the email and
   password in .local-qa/credentials.json.
2. Playwright: browser.newContext({ storageState: ".local-qa/storage-state.json" }),
   then open ${appUrl}/en (cookies just issued; rerun for fresh ones).
3. Other browsers: set the __convexAuthJWT and __convexAuthRefreshToken
   cookies (path /) on ${appUrl} to the values in .local-qa/storage-state.json.`);
