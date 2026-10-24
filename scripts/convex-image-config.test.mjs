import assert from "node:assert/strict";
import { test } from "node:test";
import { convexImageConfig } from "./convex-image-config.mjs";

test("the optimizer fetches only the configured deployment's storage path", () => {
  assert.deepEqual(
    convexImageConfig("https://happy-otter-123.convex.cloud", "production"),
    {
      remotePatterns: [
        {
          protocol: "https",
          hostname: "happy-otter-123.convex.cloud",
          port: "",
          pathname: "/api/storage/**",
        },
      ],
      unoptimized: false,
    },
  );
});

test("a loopback backend in development is served unoptimized", () => {
  const config = convexImageConfig("http://127.0.0.1:3210", "development");
  assert.equal(config.unoptimized, true);
  assert.deepEqual(config.remotePatterns.at(-1), {
    protocol: "http",
    hostname: "127.0.0.1",
    port: "3210",
    pathname: "/api/storage/**",
  });
});

test("a production build keeps the optimizer pinned to a loopback backend", () => {
  const config = convexImageConfig("http://localhost:3210", "production");
  assert.equal(config.unoptimized, false);
  assert.deepEqual(config.remotePatterns, [
    {
      protocol: "http",
      hostname: "localhost",
      port: "3210",
      pathname: "/api/storage/**",
    },
  ]);
});

test("without a deployment URL any Convex cloud host is accepted", () => {
  for (const value of [undefined, "", "not a url"]) {
    assert.deepEqual(convexImageConfig(value, "production"), {
      remotePatterns: [{ protocol: "https", hostname: "*.convex.cloud" }],
      unoptimized: false,
    });
  }
});
