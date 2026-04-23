"use client";

import { formatDateFns } from "@/lib/format-date";
import { useCurrentLocale, useScopedI18n } from "@/locales/client";
import { ScrollArea } from "@v1/ui/scroll-area";
import {
  Archive,
  CheckCircle,
  Clock,
  ShieldCheck,
  XCircle,
} from "lucide-react";
import Link from "next/link";
import type { DeaccessionKanbanItem } from "./deaccession-kanban";

type DeaccessionKanbanColumnProps = {
  deaccessions: { page: DeaccessionKanbanItem[] };
  roleName?: string;
  searchQuery: string;
  stepName: string;
  stepNumber: number;
};

const stepDotStyles: Record<number, string> = {
  1: "bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.5)]",
  2: "bg-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.5)]",
  3: "bg-violet-500 shadow-[0_0_8px_rgba(139,92,246,0.5)]",
  4: "bg-cyan-500 shadow-[0_0_8px_rgba(6,182,212,0.5)]",
  [-1]: "bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]",
  [-2]: "bg-rose-500 shadow-[0_0_8px_rgba(244,63,94,0.5)]",
};

const DEFAULT_DOT_STYLE = "bg-muted-foreground";

function getStepDotStyle(stepNumber: number): string {
  const directStyle = stepDotStyles[stepNumber];
  if (directStyle) {
    return directStyle;
  }

  const moduloStyle = stepDotStyles[((stepNumber - 1) % 4) + 1];
  if (moduloStyle) {
    return moduloStyle;
  }

  return DEFAULT_DOT_STYLE;
}

function getStepIcon(stepNumber: number) {
  if (stepNumber === -1) {
    return <CheckCircle className="h-4 w-4" />;
  }

  if (stepNumber === -2) {
    return <XCircle className="h-4 w-4" />;
  }

  if (stepNumber === 1) {
    return <Clock className="h-4 w-4" />;
  }

  if (stepNumber === 2) {
    return <Archive className="h-4 w-4" />;
  }

  return <ShieldCheck className="h-4 w-4" />;
}

export function DeaccessionKanbanColumn({
  deaccessions,
  roleName,
  searchQuery,
  stepName,
  stepNumber,
}: DeaccessionKanbanColumnProps) {
  const locale = useCurrentLocale();
  const t = useScopedI18n("deaccessions");
  const dotStyle = getStepDotStyle(stepNumber);
  const icon = getStepIcon(stepNumber);
  const normalizedSearchQuery = searchQuery.trim().toLowerCase();

  const filteredDeaccessions = deaccessions.page.filter((item) => {
    const currentStep = item.workflowStep ?? 1;

    const matchesStep =
      stepNumber === -1
        ? item.status === "approved"
        : stepNumber === -2
          ? item.status === "rejected"
          : item.status === "pending" && currentStep === stepNumber;

    const matchesSearch = normalizedSearchQuery
      ? item.deaccessionNumber.toLowerCase().includes(normalizedSearchQuery) ||
        item.collectionTitle.toLowerCase().includes(normalizedSearchQuery) ||
        item.accessionNumber?.toLowerCase().includes(normalizedSearchQuery) ||
        item.reason.toLowerCase().includes(normalizedSearchQuery) ||
        item.method.toLowerCase().includes(normalizedSearchQuery)
      : true;

    return matchesStep && matchesSearch;
  });

  return (
    <div className="flex w-72 flex-shrink-0 flex-col">
      <div className="mb-2 flex items-center justify-between text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        <span>
          {stepName}
          {roleName ? (
            <span className="ml-1 text-muted-foreground/85">({roleName})</span>
          ) : null}
        </span>
        <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">
          {filteredDeaccessions.length}
        </span>
      </div>

      <div className="flex-1 rounded-xl border border-border/60 bg-card">
        <ScrollArea className="h-full max-h-[calc(100vh-280px)]">
          <div className="flex flex-col gap-2 p-2">
            {filteredDeaccessions.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 text-center">
                <div className="text-muted-foreground">{icon}</div>
                <p className="mt-2 text-xs text-muted-foreground">
                  {t("table.noResults")}
                </p>
              </div>
            ) : (
              filteredDeaccessions.map((item, index) => (
                <Link
                  key={item._id}
                  href={`/deaccessions/${item._id}`}
                  className="group block animate-enter cursor-pointer rounded-lg border border-border bg-background/70 p-3 transition-colors hover:border-ring/60 hover:bg-accent/50"
                  style={{ animationDelay: `${Math.min(index * 50, 300)}ms` }}
                >
                  <div className="mb-2 flex items-start justify-between">
                    <div className="min-w-0">
                      <p className="font-mono text-[10px] text-muted-foreground">
                        {item.deaccessionNumber}
                      </p>
                      {item.accessionNumber ? (
                        <p className="truncate text-[10px] text-muted-foreground/80">
                          {item.accessionNumber}
                        </p>
                      ) : null}
                    </div>
                    <div className={`h-1.5 w-1.5 rounded-full ${dotStyle}`} />
                  </div>

                  <p className="mb-1 line-clamp-2 text-sm font-medium text-foreground transition-colors group-hover:text-primary">
                    {item.collectionTitle}
                  </p>
                  <p className="mb-3 line-clamp-2 text-xs text-muted-foreground">
                    {item.reason}
                  </p>

                  <div className="flex items-center justify-between gap-2 text-[10px] text-muted-foreground">
                    <span className="truncate">
                      {t(`method.${item.method}`)}
                    </span>
                    <span className="shrink-0 text-muted-foreground">
                      {formatDateFns(
                        new Date(item.dateDeaccessioned),
                        "MMM d, yyyy",
                        locale,
                      )}
                    </span>
                  </div>
                </Link>
              ))
            )}
          </div>
        </ScrollArea>
      </div>
    </div>
  );
}
