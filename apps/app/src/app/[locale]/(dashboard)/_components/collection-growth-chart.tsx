"use client";

import { api } from "@v1/backend/convex/_generated/api";
import type { Id } from "@v1/backend/convex/_generated/dataModel";
import {
  CHART_COLORS,
  ChartContainer,
  ChartTooltipContent,
} from "@v1/ui/charts";
import { Skeleton } from "@v1/ui/skeleton";
import { useQuery } from "convex/react";
import dynamic from "next/dynamic";
import { useOrganization } from "@/components/organization-provider";

interface ChartDataItem {
  month: string;
  count: number;
}

// Lazy load the recharts components to reduce initial bundle size
const LazyLineChart = dynamic(
  () =>
    import("recharts").then((mod) => {
      const { LineChart, Line, CartesianGrid, XAxis, YAxis, Tooltip } = mod;
      return {
        default: ({ data }: { data: ChartDataItem[] }) => (
          <LineChart
            data={data}
            margin={{ top: 10, right: 10, left: 0, bottom: 0 }}
          >
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
            <XAxis
              dataKey="month"
              tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }}
              axisLine={{ stroke: "hsl(var(--border))" }}
              tickLine={{ stroke: "hsl(var(--border))" }}
            />
            <YAxis
              tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }}
              axisLine={{ stroke: "hsl(var(--border))" }}
              tickLine={{ stroke: "hsl(var(--border))" }}
              allowDecimals={false}
            />
            <Tooltip content={<ChartTooltipContent />} />
            <Line
              type="monotone"
              dataKey="count"
              stroke={CHART_COLORS.indigo}
              strokeWidth={2}
              dot={{ fill: CHART_COLORS.indigo, strokeWidth: 0, r: 4 }}
              activeDot={{ r: 6, strokeWidth: 0 }}
              name="Objects Added"
            />
          </LineChart>
        ),
      };
    }),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-[300px] items-center justify-center">
        <div className="animate-pulse text-sm text-muted-foreground">
          Loading chart...
        </div>
      </div>
    ),
  },
);

export function CollectionGrowthChart() {
  const { currentOrganizationId } = useOrganization();

  const data = useQuery(
    api.dashboard.getCollectionGrowth,
    currentOrganizationId
      ? { organizationId: currentOrganizationId as Id<"organizations"> }
      : "skip",
  );

  if (data === undefined) {
    return <Skeleton className="h-[300px] w-full" />;
  }

  if (data.length === 0) {
    return (
      <div className="flex h-[300px] items-center justify-center text-muted-foreground">
        No data available
      </div>
    );
  }

  return (
    <ChartContainer height={300}>
      <LazyLineChart data={data} />
    </ChartContainer>
  );
}
