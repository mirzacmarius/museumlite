"use client";

import type { ReactElement } from "react";
import { ResponsiveContainer } from "recharts";
import { cn } from "../../utils";

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
      <ResponsiveContainer width="100%" height="100%">
        {children}
      </ResponsiveContainer>
    </div>
  );
}
