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
import { chmodSync, existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import {
  credentialsPath,
  qaAppUrl,
  readState,
  signInQaUser,
  stateDir,
} from "./lib.mjs";

const { state } = readState();
if (!existsSync(credentialsPath)) {
  console.error("✗ No QA user found. Run `bun run qa:seed` first.");
  process.exit(1);
}
const { email, password } = JSON.parse(readFileSync(credentialsPath, "utf8"));
const { tokens } = await signInQaUser(state.url, email, password);

const appUrl = qaAppUrl();
// Convex Auth's Next.js cookies; on localhost they carry no __Host- prefix.
const cookie = (name, value) => ({
  name,
  value,
  domain: new URL(appUrl).hostname,
  path: "/",
  expires: -1,
  httpOnly: true,
  secure: false,
  sameSite: "Lax",
});
const storageStatePath = join(stateDir, "storage-state.json");
writeFileSync(
  storageStatePath,
  JSON.stringify(
    {
      cookies: [
        cookie("__convexAuthJWT", tokens.token),
        cookie("__convexAuthRefreshToken", tokens.refreshToken),
      ],
      origins: [],
    },
    null,
    2,
  ),
);
chmodSync(storageStatePath, 0o600);

console.log(`Signed-in browser session for ${email} on ${appUrl}:

1. Login page: open ${appUrl}/en/login and sign in with the email and
   password in .local-qa/credentials.json.
2. Playwright: browser.newContext({ storageState: ".local-qa/storage-state.json" }),
   then open ${appUrl}/en (cookies just issued; rerun for fresh ones).
3. Other browsers: set the __convexAuthJWT and __convexAuthRefreshToken
   cookies (path /) on ${appUrl} to the values in .local-qa/storage-state.json.`);
