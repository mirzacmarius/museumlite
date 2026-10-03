"use client";

import { cn } from "@v1/ui/utils";
import { ArrowRightLeft, LayoutGrid } from "lucide-react";
import Link from "next/link";
import { useI18n } from "@/locales/client";

type AccessionsWorkbenchView = "overview" | "transfers";

type AccessionsWorkbenchNavProps = {
  activeView: AccessionsWorkbenchView;
  pendingAccessions: number | string;
  pendingTransfers: number | string;
};

const navItems = [
  {
    view: "overview",
    href: "/accessions",
    labelKey: "untranslatedRecords.accessions.workbench.overview",
    descriptionKey:
      "untranslatedRecords.accessions.workbench.overviewDescription",
    icon: LayoutGrid,
  },
  {
    view: "transfers",
    href: "/accessions/transfers",
    labelKey: "untranslatedRecords.accessions.workbench.transfers",
    descriptionKey:
      "untranslatedRecords.accessions.workbench.transfersDescription",
    icon: ArrowRightLeft,
  },
] as const;

export function AccessionsWorkbenchNav({
  activeView,
  pendingAccessions,
  pendingTransfers,
}: AccessionsWorkbenchNavProps) {
  const tRoot = useI18n();
  const metrics = {
    overview: pendingAccessions,
    transfers: pendingTransfers,
  };

  return (
    <div className="mb-6 rounded-2xl border border-border/60 bg-card/70 p-3">
      <div className="grid gap-2 md:grid-cols-2">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeView === item.view;

          return (
            <Link
              key={item.view}
              href={item.href}
              className={cn(
                "flex items-center justify-between gap-4 rounded-xl border px-4 py-3 transition-colors",
                isActive
                  ? "border-primary/35 bg-primary/10 text-foreground"
                  : "border-transparent bg-background/40 text-muted-foreground hover:border-border hover:bg-background/70 hover:text-foreground",
              )}
            >
              <div className="flex min-w-0 items-center gap-3">
                <div
                  className={cn(
                    "flex size-9 shrink-0 items-center justify-center rounded-lg border",
                    isActive
                      ? "border-primary/30 bg-primary/15 text-primary"
                      : "border-border/60 bg-background text-muted-foreground",
                  )}
                >
                  <Icon className="size-4" />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-medium">{tRoot(item.labelKey)}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    {tRoot(item.descriptionKey)}
                  </p>
                </div>
              </div>
              <div className="shrink-0 rounded-full border border-border/60 bg-background px-2.5 py-1 text-xs font-medium text-foreground">
                {metrics[item.view]}
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
