#!/usr/bin/env node
/**
 * Prepare auth on the local QA backend and create a synthetic QA user with an
 * organization. Run after `bun run qa:backend` and
 * `bun run convex:local -- deploy --yes`.
 *
 *   bun run qa:seed
 *
 * Writes .local-qa/credentials.json (gitignored, mode 0600). The account signs
 * in through the app's real login page. Nothing here touches a cloud
 * deployment.
 */
import { generateKeyPairSync, randomBytes } from "node:crypto";
import { chmodSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import {
  credentialsPath,
  localOnlyEnv,
  QA_AUTH_PROVIDER,
  qaAppUrl,
  readState,
  root,
  run,
  signInQaUser,
} from "./lib.mjs";

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
  SITE_URL: qaAppUrl(),
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
    { stdio: ["ignore", "ignore", "inherit"], env: localOnlyEnv() },
  );
  if (status !== 0) {
    console.error(`✗ Failed to set ${name} on the local backend`);
    process.exit(status);
  }
}

const userTag = randomBytes(4).toString("hex");
const email = `qa-${userTag}@example.test`;
const password = randomBytes(18).toString("base64url");

// Public sign-up emails a verification code the local backend cannot deliver,
// so create the account through Convex Auth's internal store (it hashes the
// secret) under the login page's provider, with the email already verified.
const accountStatus = run(
  "node",
  [
    join(root, "scripts/local-qa/convex-local.mjs"),
    "run",
    "auth:store",
    JSON.stringify({
      args: {
        type: "createAccountFromCredentials",
        provider: QA_AUTH_PROVIDER,
        account: { id: email, secret: password },
        profile: { email, emailVerified: true },
        shouldLinkViaEmail: false,
        shouldLinkViaPhone: false,
      },
    }),
  ],
  { stdio: ["ignore", "ignore", "inherit"], env: localOnlyEnv() },
);
if (accountStatus !== 0) {
  console.error("✗ Failed to create the QA account on the local backend");
  process.exit(accountStatus);
}

const { client, api } = await signInQaUser(state.url, email, password);

// A username and an organization let sign-in land on the dashboard instead of
// onboarding.
await client.mutation(api.users.updateUsername, { username: `qa${userTag}` });
const organizationId = await client.mutation(api.organizations.create, {
  name: "QA Museum",
  slug: `qa-museum-${randomBytes(2).toString("hex")}`,
  type: "museum",
});

writeFileSync(
  credentialsPath,
  JSON.stringify({ email, password, organizationId }, null, 2),
);
chmodSync(credentialsPath, 0o600);
console.log(
  `✓ QA user ${email} created; sign in at ${qaAppUrl()}/en/login with .local-qa/credentials.json`,
);
