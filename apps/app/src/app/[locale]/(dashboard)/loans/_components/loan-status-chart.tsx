"use client";

import { useOrganization } from "@/components/organization-provider";
import { useScopedI18n } from "@/locales/client";
import { api } from "@v1/backend/convex/_generated/api";
import type { Id } from "@v1/backend/convex/_generated/dataModel";
import {
  CHART_COLOR_ARRAY,
  ChartContainer,
  ChartTooltipContent,
} from "@v1/ui/charts";
import { Skeleton } from "@v1/ui/skeleton";
import { useQuery } from "convex/react";
import { Cell, Legend, Pie, PieChart, Tooltip } from "recharts";

const STATUS_COLORS: Record<string, string> = {
  pending: CHART_COLOR_ARRAY[3] ?? "#fbbf24",
  active: CHART_COLOR_ARRAY[1] ?? "#34d399",
  dispatched: CHART_COLOR_ARRAY[5] ?? "#22d3ee",
  returned: CHART_COLOR_ARRAY[0] ?? "#818cf8",
  cancelled: CHART_COLOR_ARRAY[4] ?? "#fb7185",
};

export function LoanStatusChart() {
  const t = useScopedI18n("loans");
  const { currentOrganizationId } = useOrganization();

  const data = useQuery(
    api.loans.getStatusDistribution,
    currentOrganizationId
      ? { organizationId: currentOrganizationId as Id<"organizations"> }
      : "skip",
  );

  if (data === undefined) {
    return <Skeleton className="h-[250px] w-full rounded-xl" />;
  }

  if (data.length === 0) {
    return (
      <div className="flex h-[250px] items-center justify-center rounded-xl border border-border/60 bg-card text-sm text-muted-foreground">
        {t("emptyState.noLoansFound")}
      </div>
    );
  }

  const chartData = data.map((item) => ({
    ...item,
    name: item.status.charAt(0).toUpperCase() + item.status.slice(1),
  }));

  return (
    <div className="rounded-xl border border-border/60 bg-card p-4">
      <h3 className="mb-4 text-sm font-medium">
        {t("charts.statusDistribution")}
      </h3>
      <ChartContainer height={200}>
        <PieChart>
          <Pie
            data={chartData}
            cx="50%"
            cy="50%"
            innerRadius={50}
            outerRadius={70}
            paddingAngle={2}
            dataKey="count"
            nameKey="name"
          >
            {chartData.map((entry, index) => (
              <Cell
                key={entry.status}
                fill={
                  STATUS_COLORS[entry.status] ??
                  CHART_COLOR_ARRAY[index % CHART_COLOR_ARRAY.length] ??
                  "#818cf8"
                }
              />
            ))}
          </Pie>
          <Tooltip content={<ChartTooltipContent />} />
          <Legend
            formatter={(value) => (
              <span className="text-xs text-muted-foreground">{value}</span>
            )}
          />
        </PieChart>
      </ChartContainer>
    </div>
  );
}
