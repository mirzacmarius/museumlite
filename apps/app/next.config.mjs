import { convexImageConfig } from "../../scripts/convex-image-config.mjs";
import { loadMonorepoEnv } from "../../scripts/load-monorepo-env.mjs";

loadMonorepoEnv(import.meta.url);

import "./src/env.mjs";
import { withSentryConfig } from "@sentry/nextjs";

// Skip TypeScript checking during Vercel builds to prevent OOM and speed up deployment
// Type checking should be done in CI/pre-commit hooks instead
const skipTypeCheck =
  process.env.SKIP_TYPE_CHECK === "true" ||
  process.env.NEXT_DISABLE_TYPECHECK === "1" ||
  Boolean(process.env.VERCEL);

/** @type {import('next').NextConfig} */
const nextConfig = {
  turbopack: {},
  images: convexImageConfig(),
  // Skip TypeScript checking during build to prevent OOM
  // Type checking runs in CI/pre-commit hooks for faster deployments
  typescript: {
    ignoreBuildErrors: skipTypeCheck,
  },
  // Note: Test files are excluded via tsconfig.json exclude patterns
  // This ensures they don't consume memory during TypeScript type checking
};

export default withSentryConfig(nextConfig, {
  silent: !process.env.CI,
  telemetry: false,
  widenClientFileUpload: true,
  hideSourceMaps: true,
  tunnelRoute: "/monitoring",
});
