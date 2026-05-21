"use client";

import {
  AlertTriangle,
  ArrowDownToLine,
  ArrowUpFromLine,
  BookOpen,
  Clock,
} from "lucide-react";

interface CirculationStatisticsData {
  activeCheckouts: number;
  overdueItems: number;
  dueSoon: number;
  checkoutsToday: number;
  returnsToday: number;
  lostItems: number;
}

interface CirculationStatisticsProps {
  statistics: CirculationStatisticsData;
  tCirc: (key: string) => string;
}

export function CirculationStatistics({
  statistics,
  tCirc,
}: CirculationStatisticsProps) {
  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
      <div className="rounded-lg border border-border bg-card p-4">
        <div className="flex items-center gap-2 text-muted-foreground">
          <BookOpen className="size-4" />
          <span className="text-sm">{tCirc("stats.active")}</span>
        </div>
        <p className="mt-2 text-2xl font-medium">
          {statistics.activeCheckouts}
        </p>
      </div>
      <div className="rounded-lg border border-destructive bg-destructive/10 p-4">
        <div className="flex items-center gap-2 text-destructive">
          <AlertTriangle className="size-4" />
          <span className="text-sm">{tCirc("stats.overdue")}</span>
        </div>
        <p className="mt-2 text-2xl font-medium text-destructive">
          {statistics.overdueItems}
        </p>
      </div>
      <div className="rounded-lg border border-border bg-card p-4">
        <div className="flex items-center gap-2 text-muted-foreground">
          <Clock className="size-4" />
          <span className="text-sm">{tCirc("stats.dueSoon")}</span>
        </div>
        <p className="mt-2 text-2xl font-medium">{statistics.dueSoon}</p>
      </div>
      <div className="rounded-lg border border-border bg-card p-4">
        <div className="flex items-center gap-2 text-muted-foreground">
          <ArrowUpFromLine className="size-4" />
          <span className="text-sm">{tCirc("stats.todayOut")}</span>
        </div>
        <p className="mt-2 text-2xl font-medium">{statistics.checkoutsToday}</p>
      </div>
      <div className="rounded-lg border border-border bg-card p-4">
        <div className="flex items-center gap-2 text-muted-foreground">
          <ArrowDownToLine className="size-4" />
          <span className="text-sm">{tCirc("stats.todayIn")}</span>
        </div>
        <p className="mt-2 text-2xl font-medium">{statistics.returnsToday}</p>
      </div>
      <div className="rounded-lg border border-border bg-card p-4">
        <div className="flex items-center gap-2 text-muted-foreground">
          <AlertTriangle className="size-4" />
          <span className="text-sm">{tCirc("stats.lost")}</span>
        </div>
        <p className="mt-2 text-2xl font-medium">{statistics.lostItems}</p>
      </div>
    </div>
  );
}
