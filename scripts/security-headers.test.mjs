import assert from "node:assert/strict";
import { test } from "node:test";
import {
  contentSecurityPolicy,
  securityHeaders,
  sentrySecurityReportUri,
} from "./security-headers.mjs";

// Explicit nulls keep the deployment's own environment out of the tests.
const production = {
  convexUrl: "https://happy-otter-123.convex.cloud",
  convexSiteUrl: null,
  webUrl: null,
  sentryDsn: "https://publickey@o42.ingest.de.sentry.io/4507",
  nodeEnv: "production",
};

function directives(policy) {
  return new Map(
    policy.split("; ").map((directive) => {
      const [name, ...values] = directive.split(" ");
      return [name, values];
    }),
  );
}

test("every response forbids framing and sniffing", () => {
  const headers = new Map(
    securityHeaders(production).map(({ key, value }) => [key, value]),
  );
  assert.equal(headers.get("X-Frame-Options"), "DENY");
  assert.equal(headers.get("X-Content-Type-Options"), "nosniff");
  assert.equal(
    headers.get("Referrer-Policy"),
    "strict-origin-when-cross-origin",
  );
  assert.match(headers.get("Permissions-Policy"), /camera=\(\)/);
  // Report-only until the reports show the policy fits.
  assert.equal(headers.has("Content-Security-Policy"), false);
  assert.ok(headers.has("Content-Security-Policy-Report-Only"));
});

test("the policy allows the deployment's own Convex hosts", () => {
  const policy = directives(contentSecurityPolicy(production));
  assert.deepEqual(policy.get("frame-ancestors"), ["'none'"]);
  assert.deepEqual(policy.get("object-src"), ["'none'"]);
  const connect = policy.get("connect-src");
  assert.ok(connect.includes("https://happy-otter-123.convex.cloud"));
  assert.ok(connect.includes("wss://happy-otter-123.convex.cloud"));
  assert.ok(connect.includes("https://happy-otter-123.convex.site"));
  assert.ok(
    policy.get("img-src").includes("https://happy-otter-123.convex.cloud"),
  );
  assert.ok(
    policy.get("media-src").includes("https://happy-otter-123.convex.cloud"),
  );
  const frames = policy.get("frame-src");
  assert.ok(frames.includes("https://happy-otter-123.convex.cloud"));
  assert.ok(frames.includes("https://sketchfab.com"));
  assert.ok(frames.includes("https://www.museumlite.com"));
  assert.equal(frames.includes("http://localhost:3001"), false);
  assert.equal(policy.get("script-src").includes("'unsafe-eval'"), false);
  assert.deepEqual(policy.get("report-uri"), [
    "https://o42.ingest.de.sentry.io/api/4507/security/?sentry_key=publickey",
  ]);
});

test("a configured site URL and portal URL are used as given", () => {
  const policy = directives(
    contentSecurityPolicy({
      ...production,
      convexSiteUrl: "https://api.example.test/convex",
      webUrl: "https://portal.example.test/",
      sentryDsn: null,
    }),
  );
  assert.ok(policy.get("connect-src").includes("https://api.example.test"));
  assert.equal(
    policy.get("connect-src").includes("https://happy-otter-123.convex.site"),
    false,
  );
  assert.ok(policy.get("frame-src").includes("https://portal.example.test"));
  assert.equal(policy.has("report-uri"), false);
});

test("development allows fast refresh and the local portal", () => {
  const policy = directives(
    contentSecurityPolicy({
      convexUrl: "http://127.0.0.1:3210",
      convexSiteUrl: "http://127.0.0.1:3211",
      webUrl: null,
      sentryDsn: null,
      nodeEnv: "development",
    }),
  );
  assert.ok(policy.get("script-src").includes("'unsafe-eval'"));
  assert.ok(policy.get("connect-src").includes("ws://127.0.0.1:3210"));
  assert.ok(policy.get("connect-src").includes("http://127.0.0.1:3211"));
  assert.ok(policy.get("frame-src").includes("http://localhost:3001"));
});

test("a Sentry DSN without a key or project gives no report URI", () => {
  assert.equal(sentrySecurityReportUri(undefined), null);
  assert.equal(sentrySecurityReportUri("not a dsn"), null);
  assert.equal(sentrySecurityReportUri("https://o1.ingest.sentry.io/1"), null);
  assert.equal(
    sentrySecurityReportUri("https://key@o1.ingest.sentry.io/"),
    null,
  );
});
