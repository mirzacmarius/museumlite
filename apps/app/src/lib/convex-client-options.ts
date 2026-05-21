/** ConvexReactClient options — verbose logging only in development. */
export const convexClientOptions = {
  verbose: process.env.NODE_ENV === "development",
} as const;
