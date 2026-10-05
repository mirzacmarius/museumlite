const LOOPBACK_HOSTS = new Set(["127.0.0.1", "localhost", "[::1]"]);

/**
 * Next Image settings for Convex storage URLs.
 * Cloud deployments are optimized through `*.convex.cloud`. A loopback
 * self-hosted backend in development is allowed by exact origin and served
 * unoptimized, so the optimizer never fetches private addresses.
 */
export function convexImageConfig(
  convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL,
  nodeEnv = process.env.NODE_ENV,
) {
  const remotePatterns = [{ protocol: "https", hostname: "*.convex.cloud" }];
  if (!convexUrl || nodeEnv === "production") {
    return { remotePatterns, unoptimized: false };
  }
  let url;
  try {
    url = new URL(convexUrl);
  } catch {
    return { remotePatterns, unoptimized: false };
  }
  if (!LOOPBACK_HOSTS.has(url.hostname)) {
    return { remotePatterns, unoptimized: false };
  }
  remotePatterns.push({
    protocol: url.protocol.replace(":", ""),
    hostname: url.hostname,
    port: url.port,
    pathname: "/api/storage/**",
  });
  return { remotePatterns, unoptimized: true };
}
