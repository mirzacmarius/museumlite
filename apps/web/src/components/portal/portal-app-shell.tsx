import "@v1/ui/globals.css";
import { MotionProvider } from "@v1/ui/motion-provider";
import { cn } from "@v1/ui/utils";
import { GeistMono } from "geist/font/mono";
import { GeistSans } from "geist/font/sans";
import type { ReactNode } from "react";
import { ConvexClientProvider } from "@/app/convex-client-provider";
import { DeferredSiteAnalytics } from "@/components/site/deferred-site-analytics";

interface PortalAppShellProps {
  children: ReactNode;
}

export function PortalAppShell({ children }: PortalAppShellProps) {
  return (
    <div
      className={cn(
        GeistSans.variable,
        GeistMono.variable,
        "min-h-screen font-sans antialiased",
      )}
    >
      <MotionProvider>
        <ConvexClientProvider>
          {children}
          <DeferredSiteAnalytics />
        </ConvexClientProvider>
      </MotionProvider>
    </div>
  );
}
