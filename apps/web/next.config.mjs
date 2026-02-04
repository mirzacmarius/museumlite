/** @type {import('next').NextConfig} */
const nextConfig = {
  // Force webpack instead of Turbopack due to thread-stream compatibility issues
  // Turbopack doesn't support worker threads used by pino/thread-stream
  // Next.js 16 canary defaults to Turbopack, configuring webpack forces webpack usage
  webpack: (config, { isServer }) => {
    // Exclude thread-stream from being processed (server-only)
    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        "thread-stream": false,
      };
    }
    return config;
  },
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "*.convex.cloud",
      },
    ],
  },
  // Exclude server-only packages from client bundle
  serverExternalPackages: ["pino", "thread-stream"],
  // Skip TypeScript checking during Vercel builds (same as app)
  typescript: {
    ignoreBuildErrors:
      process.env.SKIP_TYPE_CHECK === "true" ||
      process.env.NEXT_DISABLE_TYPECHECK === "1" ||
      Boolean(process.env.VERCEL),
  },
};

export default nextConfig;
