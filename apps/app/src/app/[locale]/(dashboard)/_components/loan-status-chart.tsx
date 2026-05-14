"use client";

import { CHART_COLOR_ARRAY, ChartContainer } from "@v1/ui/charts";
import dynamic from "next/dynamic";

interface LoanStatusChartProps {
  data: {
    pending: number;
    active: number;
    returned: number;
  };
}

interface ChartData {
  name: string;
  value: number;
  color: string;
}

// Lazy load the recharts components to reduce initial bundle size
const LazyPieChart = dynamic(
  () =>
    import("recharts").then((mod) => {
      const { PieChart, Pie, Cell, Tooltip } = mod;
      return {
        default: ({ chartData }: { chartData: ChartData[] }) => (
          <PieChart>
            <Pie
              data={chartData}
              cx="50%"
              cy="50%"
              innerRadius={50}
              outerRadius={80}
              paddingAngle={2}
              dataKey="value"
            >
              {chartData.map((entry) => (
                <Cell key={entry.name} fill={entry.color} />
              ))}
            </Pie>
            <Tooltip
              contentStyle={{
                backgroundColor: "hsl(var(--card))",
                border: "1px solid hsl(var(--border))",
                borderRadius: "8px",
              }}
            />
          </PieChart>
        ),
      };
    }),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-[200px] items-center justify-center">
        <div className="animate-pulse text-sm text-muted-foreground">
          Loading chart...
        </div>
      </div>
    ),
  },
);

export function LoanStatusChart({ data }: LoanStatusChartProps) {
  const chartData = [
    {
      name: "Pending",
      value: data.pending,
      color: CHART_COLOR_ARRAY[0] ?? "rgb(129, 140, 248)",
    },
    {
      name: "Active",
      value: data.active,
      color: CHART_COLOR_ARRAY[1] ?? "rgb(52, 211, 153)",
    },
    {
      name: "Returned",
      value: data.returned,
      color: CHART_COLOR_ARRAY[2] ?? "rgb(251, 191, 36)",
    },
  ].filter((d) => d.value > 0);

  const total = chartData.reduce((sum, d) => sum + d.value, 0);

  if (chartData.length === 0 || total === 0) {
    return (
      <div className="flex h-[200px] items-center justify-center text-muted-foreground text-sm">
        No loan data available
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <ChartContainer height={200}>
        <LazyPieChart chartData={chartData} />
      </ChartContainer>
      <div className="flex justify-center gap-4">
        {chartData.map((entry) => (
          <div key={entry.name} className="flex items-center gap-2 text-xs">
            <div
              className="size-3 rounded-full"
              style={{ backgroundColor: entry.color }}
            />
            <span className="text-muted-foreground">
              {entry.name}: {entry.value}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
