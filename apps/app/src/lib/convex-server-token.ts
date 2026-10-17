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
