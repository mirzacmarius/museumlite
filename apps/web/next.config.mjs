/** @type {import('next').NextConfig} */
const nextConfig = {
  // Required for Next.js 16 - explicitly configure turbopack
  turbopack: {},
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "*.convex.cloud",
      },
    ],
  },
  // Exclude server-only packages from client bundle
  // pino and thread-stream use worker threads which aren't bundler-compatible
  serverExternalPackages: ["pino", "thread-stream"],
  // Skip TypeScript checking during Vercel builds
  typescript: {
    ignoreBuildErrors:
      process.env.SKIP_TYPE_CHECK === "true" ||
      process.env.NEXT_DISABLE_TYPECHECK === "1" ||
      Boolean(process.env.VERCEL),
  },
};

export default nextConfig;
