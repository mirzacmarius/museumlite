#!/usr/bin/env node
/**
 * Prepare auth on the local QA backend and create a synthetic QA user with an
 * organization. Run after `bun run qa:backend` and
 * `bun run convex:local -- deploy --yes`.
 *
 *   bun run qa:seed
 *
 * Writes .local-qa/credentials.json (gitignored, mode 0600). Nothing here
 * touches a cloud deployment.
 */
import { generateKeyPairSync, randomBytes } from "node:crypto";
import { chmodSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { localOnlyEnv, readState, root, run, stateDir } from "./lib.mjs";

const { state } = readState();

const { publicKey, privateKey } = generateKeyPairSync("rsa", {
  modulusLength: 2048,
});
const jwk = publicKey.export({ format: "jwk" });
// CONVEX_SITE_URL is reserved: the backend derives it from its site-proxy port.
const authEnv = {
  JWT_PRIVATE_KEY: privateKey
    .export({ type: "pkcs8", format: "pem" })
    .trimEnd()
    .replace(/\n/g, " "),
  JWKS: JSON.stringify({ keys: [{ use: "sig", alg: "RS256", ...jwk }] }),
  SITE_URL: process.env.QA_APP_URL ?? "http://localhost:3000",
};

for (const [name, value] of Object.entries(authEnv)) {
  const status = run(
    "node",
    [
      join(root, "scripts/local-qa/convex-local.mjs"),
      "env",
      "set",
      `${name}=${value}`,
    ],
    { stdio: "ignore", env: localOnlyEnv() },
  );
  if (status !== 0) {
    console.error(`✗ Failed to set ${name} on the local backend`);
    process.exit(status);
  }
}

const { ConvexHttpClient } = await import(
  pathToFileURL(join(root, "node_modules/convex/dist/esm/browser/index.js"))
    .href
);
const { api } = await import(
  pathToFileURL(join(root, "packages/backend/convex/_generated/api.js")).href
);

const email = `qa-${randomBytes(4).toString("hex")}@example.test`;
const password = randomBytes(18).toString("base64url");
const client = new ConvexHttpClient(state.url);

const signedIn = await client.action(api.auth.signIn, {
  provider: "password",
  params: { email, password, flow: "signUp" },
});
if (!signedIn.tokens?.token) {
  console.error("✗ Sign-up did not return a session token");
  process.exit(1);
}
client.setAuth(signedIn.tokens.token);

const organizationId = await client.mutation(api.organizations.create, {
  name: "QA Museum",
  slug: `qa-museum-${randomBytes(2).toString("hex")}`,
  type: "museum",
});

const credentialsPath = join(stateDir, "credentials.json");
writeFileSync(
  credentialsPath,
  JSON.stringify({ email, password, organizationId }, null, 2),
);
chmodSync(credentialsPath, 0o600);
console.log(
  `✓ QA user ${email} created; credentials in .local-qa/credentials.json`,
);
