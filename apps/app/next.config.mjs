import "./src/env.mjs";
import { withSentryConfig } from "@sentry/nextjs";

const isVercel = Boolean(process.env.VERCEL);

/** @type {import('next').NextConfig} */
const nextConfig = {
  turbopack: {},
  typescript: {
    ignoreBuildErrors: isVercel,
  },
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "*.convex.cloud",
      },
    ],
  },
  // Optimize TypeScript checking for memory-constrained environments
  typescript: {
    // Only ignore build errors if explicitly enabled via env var (fallback)
    ignoreBuildErrors: process.env.SKIP_TYPE_CHECK === "true",
  },
  // Note: Test files are excluded via tsconfig.json exclude patterns
  // This ensures they don't consume memory during TypeScript type checking
};

export default withSentryConfig(nextConfig, {
  silent: !process.env.CI,
  telemetry: false,
  widenClientFileUpload: true,
  hideSourceMaps: true,
  disableLogger: true,
  tunnelRoute: "/monitoring",
});
