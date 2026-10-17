// @boundaries-ignore Shared Next.js config helpers live in the root scripts folder
import { convexImageConfig } from "../../scripts/convex-image-config.mjs";
// @boundaries-ignore Shared Next.js config helpers live in the root scripts folder
import { loadMonorepoEnv } from "../../scripts/load-monorepo-env.mjs";

loadMonorepoEnv(import.meta.url);

/** @type {import('next').NextConfig} */
const nextConfig = {
  // Required for Next.js 16 - explicitly configure turbopack
  turbopack: {},
  images: {
    formats: ["image/avif", "image/webp"],
    qualities: [65, 70, 75],
    deviceSizes: [640, 750, 828, 1080, 1200, 1920],
    imageSizes: [256, 384, 400, 512, 640, 800],
    ...convexImageConfig(),
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
