import "server-only";

import { convexAuthNextjsToken } from "@convex-dev/auth/nextjs/server";
import { connection } from "next/server";

/**
 * The session token for server-side Convex calls. Convex queries are live
 * data, so callers render at request time (inside a Suspense boundary) rather
 * than in a prerendered or prefetched shell.
 */
export async function getConvexServerToken() {
  await connection();
  return convexAuthNextjsToken();
}

/**
 * The session token inside a `"use cache: private"` function, where
 * `connection()` is not allowed. Only use it when the cached result seeds a
 * live query (`usePreloadedQuery`), so a snapshot from before an edit is shown
 * for a moment at most, and keep the cache's stale time short.
 */
export async function getConvexServerTokenForPrivateCache() {
  return convexAuthNextjsToken();
}
