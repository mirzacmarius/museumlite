"use client";

import { AlertCircle, ArrowRightLeft, Boxes, ShieldCheck } from "lucide-react";
import { useScopedI18n } from "@/locales/client";

interface LoanListKpisProps {
  activeLoansCount: number;
  totalItemsInTransit: number;
}

export function LoanListKpis({
  activeLoansCount,
  totalItemsInTransit,
}: LoanListKpisProps) {
  const t = useScopedI18n("loans");

  return (
    <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
      <div className="rounded-xl border border-border/60 bg-card p-4 shadow-sm transition-all duration-300 hover:border-primary/30 hover:ring-1 hover:ring-primary/30">
        <div className="mb-4 flex items-start justify-between">
          <div className="flex size-8 items-center justify-center rounded-lg border border-primary/20 bg-primary/10 text-primary">
            <ArrowRightLeft className="size-4" />
          </div>
          <span className="rounded border border-emerald-500/30 bg-emerald-500/20 px-1.5 py-0.5 text-xs font-medium text-emerald-400">
            +{activeLoansCount} active
          </span>
        </div>
        <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
          {t("kpis.activeLoans")}
        </p>
        <p className="mt-1 text-2xl font-bold tracking-tight">
          {activeLoansCount}
        </p>
      </div>

      <div className="rounded-xl border border-border/60 bg-card p-4 shadow-sm transition-all duration-300 hover:border-emerald-500/30 hover:ring-1 hover:ring-emerald-500/30">
        <div className="mb-4 flex items-start justify-between">
          <div className="flex size-8 items-center justify-center rounded-lg border border-emerald-500/20 bg-emerald-500/10 text-emerald-400">
            <Boxes className="size-4" />
          </div>
        </div>
        <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
          {t("kpis.objectsInTransit")}
        </p>
        <p className="mt-1 text-2xl font-bold tracking-tight">
          {totalItemsInTransit}
        </p>
      </div>

      <div className="rounded-xl border border-border/60 bg-card p-4 shadow-sm transition-all duration-300 hover:border-blue-500/30 hover:ring-1 hover:ring-blue-500/30">
        <div className="mb-4 flex items-start justify-between">
          <div className="flex size-8 items-center justify-center rounded-lg border border-blue-500/20 bg-blue-500/10 text-blue-400">
            <ShieldCheck className="size-4" />
          </div>
        </div>
        <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
          {t("kpis.totalInsuredValue")}
        </p>
        <p className="mt-1 text-2xl font-bold tracking-tight">-</p>
      </div>

      <div className="relative overflow-hidden rounded-xl border border-border/60 bg-card p-4 shadow-sm transition-all duration-300 hover:border-rose-500/30 hover:ring-1 hover:ring-rose-500/30">
        <div className="absolute right-0 top-0 size-16 rounded-full bg-rose-500/10 blur-2xl" />
        <div className="mb-4 flex items-start justify-between">
          <div className="flex size-8 items-center justify-center rounded-lg border border-rose-500/20 bg-rose-500/10 text-rose-400">
            <AlertCircle className="size-4" />
          </div>
          <span className="rounded border border-rose-500/30 bg-rose-500/20 px-1.5 py-0.5 text-xs font-medium text-rose-400">
            {t("kpis.actionRequired")}
          </span>
        </div>
        <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
          {t("kpis.expiringAgreements")}
        </p>
        <p className="mt-1 text-2xl font-bold tracking-tight">-</p>
      </div>
    </div>
  );
}
