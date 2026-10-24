const LOOPBACK_HOSTS = new Set(["127.0.0.1", "localhost", "[::1]"]);
const CLOUD_PATTERN = { protocol: "https", hostname: "*.convex.cloud" };

function parseUrl(value) {
  if (!value) return null;
  try {
    return new URL(value);
  } catch {
    return null;
  }
}

/**
 * Next Image settings for Convex storage URLs.
 * The optimizer fetches only from the configured deployment's storage path,
 * so it never proxies images from other Convex deployments. A loopback
 * self-hosted backend in development is allowed by exact origin and served
 * unoptimized, so the optimizer never fetches private addresses. Without a
 * configured deployment (a build that skips env validation) any Convex cloud
 * host is accepted, as before.
 */
export function convexImageConfig(
  convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL,
  nodeEnv = process.env.NODE_ENV,
) {
  const url = parseUrl(convexUrl);
  if (!url) {
    return { remotePatterns: [CLOUD_PATTERN], unoptimized: false };
  }
  const deployment = {
    protocol: url.protocol.replace(":", ""),
    hostname: url.hostname,
    port: url.port,
    pathname: "/api/storage/**",
  };
  if (LOOPBACK_HOSTS.has(url.hostname) && nodeEnv !== "production") {
    return { remotePatterns: [CLOUD_PATTERN, deployment], unoptimized: true };
  }
  return { remotePatterns: [deployment], unoptimized: false };
}
