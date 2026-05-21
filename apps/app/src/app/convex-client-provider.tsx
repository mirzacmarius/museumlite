"use client";

import { env } from "@/env.mjs";
import { convexClientOptions } from "@/lib/convex-client-options";
import { ConvexAuthNextjsProvider } from "@convex-dev/auth/nextjs";
import { ConvexReactClient } from "convex/react";
import type { ReactNode } from "react";

const convex = new ConvexReactClient(
  env.NEXT_PUBLIC_CONVEX_URL,
  convexClientOptions,
);

export function ConvexClientProvider({ children }: { children: ReactNode }) {
  return (
    <ConvexAuthNextjsProvider client={convex}>
      {children}
    </ConvexAuthNextjsProvider>
  );
}
