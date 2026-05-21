"use client";

import { lazy, type ReactElement, Suspense } from "react";
import { cn } from "../../utils";

// Lazy load ResponsiveContainer from recharts to reduce initial bundle size
const ResponsiveContainer = lazy(() =>
  import("recharts").then((mod) => ({ default: mod.ResponsiveContainer })),
);

interface ChartContainerProps {
  children: ReactElement;
  className?: string;
  height?: number | string;
}

export function ChartContainer({
  children,
  className,
  height = 300,
}: ChartContainerProps) {
  return (
    <div className={cn("w-full", className)} style={{ height }}>
      <Suspense
        fallback={
          <div className="size-full flex items-center justify-center">
            <div className="animate-pulse text-sm text-muted-foreground">
              Loading chart…
            </div>
          </div>
        }
      >
        <ResponsiveContainer width="100%" height="100%">
          {children}
        </ResponsiveContainer>
      </Suspense>
    </div>
  );
}
