/** @type {import('next').NextConfig} */
const nextConfig = {
  turbopack: {},
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "*.convex.cloud",
      },
    ],
  },
};

export default nextConfig;
