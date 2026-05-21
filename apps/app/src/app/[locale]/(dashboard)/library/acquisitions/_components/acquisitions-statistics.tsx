"use client";

import {
  AlertTriangle,
  Check,
  Clock,
  DollarSign,
  Package,
  Truck,
} from "lucide-react";
import { formatCurrency } from "@/lib/format-number";
import { useCurrentLocale, useScopedI18n } from "@/locales/client";

interface AcquisitionsStatisticsProps {
  statistics: {
    submitted: number;
    underReview: number;
    approved: number;
    ordered: number;
    received: number;
    totalSpent: number;
    pendingBudget: number;
  };
}

export function AcquisitionsStatistics({
  statistics,
}: AcquisitionsStatisticsProps) {
  const locale = useCurrentLocale();
  const tAcq = useScopedI18n("library.acquisitions");

  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-4 lg:grid-cols-6">
      <div className="rounded-lg border border-border bg-card p-4">
        <div className="flex items-center gap-2 text-muted-foreground">
          <Clock className="size-4" />
          <span className="text-sm">{tAcq("stats.pending")}</span>
        </div>
        <p className="mt-2 text-2xl font-medium">
          {statistics.submitted + statistics.underReview}
        </p>
      </div>
      <div className="rounded-lg border border-border bg-card p-4">
        <div className="flex items-center gap-2 text-green-500">
          <Check className="size-4" />
          <span className="text-sm">{tAcq("stats.approved")}</span>
        </div>
        <p className="mt-2 text-2xl font-medium">{statistics.approved}</p>
      </div>
      <div className="rounded-lg border border-border bg-card p-4">
        <div className="flex items-center gap-2 text-purple-500">
          <Truck className="size-4" />
          <span className="text-sm">{tAcq("stats.ordered")}</span>
        </div>
        <p className="mt-2 text-2xl font-medium">{statistics.ordered}</p>
      </div>
      <div className="rounded-lg border border-border bg-card p-4">
        <div className="flex items-center gap-2 text-teal-500">
          <Package className="size-4" />
          <span className="text-sm">{tAcq("stats.received")}</span>
        </div>
        <p className="mt-2 text-2xl font-medium">{statistics.received}</p>
      </div>
      <div className="rounded-lg border border-border bg-card p-4">
        <div className="flex items-center gap-2 text-muted-foreground">
          <DollarSign className="size-4" />
          <span className="text-sm">{tAcq("stats.spent")}</span>
        </div>
        <p className="mt-2 text-2xl font-medium">
          {formatCurrency(statistics.totalSpent, locale, "USD")}
        </p>
      </div>
      <div className="rounded-lg border border-border bg-card p-4">
        <div className="flex items-center gap-2 text-muted-foreground">
          <AlertTriangle className="size-4" />
          <span className="text-sm">{tAcq("stats.pendingBudget")}</span>
        </div>
        <p className="mt-2 text-2xl font-medium">
          {formatCurrency(statistics.pendingBudget, locale, "USD")}
        </p>
      </div>
    </div>
  );
}
