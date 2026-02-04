/** @type {import('next').NextConfig} */
const nextConfig = {
  // Note: Not using turbopack due to thread-stream compatibility issues
  // Turbopack doesn't support worker threads used by pino/thread-stream
  // Removing turbopack: {} makes Next.js use webpack (default), which handles this better
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
