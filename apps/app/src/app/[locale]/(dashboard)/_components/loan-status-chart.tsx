"use client";

import { CHART_COLOR_ARRAY, ChartContainer } from "@v1/ui/charts";
import { Cell, Pie, PieChart, Tooltip } from "recharts";

interface LoanStatusChartProps {
  data: {
    pending: number;
    active: number;
    returned: number;
  };
}

export function LoanStatusChart({ data }: LoanStatusChartProps) {
  const chartData = [
    { name: "Pending", value: data.pending, color: CHART_COLOR_ARRAY[0] },
    { name: "Active", value: data.active, color: CHART_COLOR_ARRAY[1] },
    { name: "Returned", value: data.returned, color: CHART_COLOR_ARRAY[2] },
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
      </ChartContainer>
      <div className="flex justify-center gap-4">
        {chartData.map((entry) => (
          <div key={entry.name} className="flex items-center gap-2 text-xs">
            <div
              className="w-3 h-3 rounded-full"
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
