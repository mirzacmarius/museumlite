"use client";

import { useScopedI18n } from "@/locales/client";
import type { Id } from "@v1/backend/convex/_generated/dataModel";
import { ScrollArea } from "@v1/ui/scroll-area";
import {
  CheckCircle,
  Clock,
  FileEdit,
  Search,
  ShieldCheck,
} from "lucide-react";
import Link from "next/link";

type AccessionItem = {
  _id: Id<"accessions">;
  accessionNumber: string;
  source: string;
  draftTitle?: string;
  method: string;
  status: "pending" | "approved" | "rejected";
  workflowStep?: number;
  assignedTo?: Id<"users">;
  assigneeName?: string;
};

type KanbanColumnProps = {
  stepNumber: number;
  stepName: string;
  roleName?: string;
  searchQuery: string;
  accessions: { page: AccessionItem[] } | null;
};

const stepDotStyles: Record<number, string> = {
  0: "bg-slate-500 shadow-[0_0_8px_rgba(100,116,139,0.5)]",
  1: "bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.5)]",
  2: "bg-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.5)]",
  3: "bg-purple-500 shadow-[0_0_8px_rgba(168,85,247,0.5)]",
  4: "bg-indigo-500 shadow-[0_0_8px_rgba(99,102,241,0.5)]",
  [-1]: "bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]",
};

const DEFAULT_DOT_STYLE = "bg-muted-foreground";

function getStepDotStyle(stepNumber: number): string {
  const direct = stepDotStyles[stepNumber];
  if (direct) return direct;

  const modulo = stepDotStyles[stepNumber % 5];
  if (modulo) return modulo;

  return DEFAULT_DOT_STYLE;
}

function getStepIcon(stepNumber: number) {
  if (stepNumber === 0) return <FileEdit className="h-4 w-4" />;
  if (stepNumber === -1) return <CheckCircle className="h-4 w-4" />;
  if (stepNumber === 1) return <Clock className="h-4 w-4" />;
  if (stepNumber === 2) return <Search className="h-4 w-4" />;
  return <ShieldCheck className="h-4 w-4" />;
}

function getInitials(name: string): string {
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

export function KanbanColumn({
  stepNumber,
  stepName,
  roleName,
  searchQuery,
  accessions,
}: KanbanColumnProps) {
  const t = useScopedI18n("accessions");

  const dotStyle = getStepDotStyle(stepNumber);
  const icon = getStepIcon(stepNumber);

  const filteredAccessions =
    accessions?.page?.filter((a: AccessionItem) => {
      const currentStep = a.workflowStep ?? 0;

      const matchesStep =
        stepNumber === -1
          ? a.status === "approved"
          : a.status === "pending" && currentStep === stepNumber;

      const matchesSearch = searchQuery
        ? a.accessionNumber
            ?.toLowerCase()
            .includes(searchQuery.toLowerCase()) ||
          a.source?.toLowerCase().includes(searchQuery.toLowerCase())
        : true;

      return matchesStep && matchesSearch;
    }) ?? [];

  return (
    <div className="flex w-72 flex-shrink-0 flex-col">
      <div className="mb-2 flex items-center justify-between text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        <span>
          {stepName}
          {roleName && (
            <span className="ml-1 text-muted-foreground/85">({roleName})</span>
          )}
        </span>
        <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">
          {filteredAccessions.length}
        </span>
      </div>

      <div className="flex-1 rounded-xl border border-border/60 bg-card">
        <ScrollArea className="h-full max-h-[calc(100vh-280px)]">
          <div className="flex flex-col gap-2 p-2">
            {filteredAccessions.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 text-center">
                <div className="text-muted-foreground">{icon}</div>
                <p className="mt-2 text-xs text-muted-foreground">
                  {t("kanban.noAccessions", { step: stepName.toLowerCase() })}
                </p>
              </div>
            ) : (
              filteredAccessions.map((accession: AccessionItem) => (
                <Link
                  key={accession._id}
                  href={`/accessions/${accession._id}`}
                  className="group block cursor-pointer rounded-lg border border-border bg-background/70 p-3 transition-colors hover:border-ring/60 hover:bg-accent/50"
                >
                  <div className="mb-2 flex items-start justify-between">
                    <span className="font-mono text-[10px] text-muted-foreground">
                      {accession.accessionNumber}
                    </span>
                    <div className={`h-1.5 w-1.5 rounded-full ${dotStyle}`} />
                  </div>
                  <p className="mb-1 line-clamp-2 text-sm font-medium text-foreground transition-colors group-hover:text-primary">
                    {accession.draftTitle ||
                      accession.source ||
                      t("kanban.unknownSource")}
                  </p>
                  <p className="mb-3 line-clamp-2 text-xs text-muted-foreground">
                    {accession.draftTitle ? accession.source : accession.method}
                  </p>
                  {accession.assigneeName && (
                    <div className="flex items-center gap-2">
                      <div className="flex size-5 items-center justify-center rounded-full bg-primary/20 text-[9px] text-primary">
                        {getInitials(accession.assigneeName)}
                      </div>
                      <span className="text-[10px] text-muted-foreground">
                        {accession.assigneeName}
                      </span>
                    </div>
                  )}
                </Link>
              ))
            )}
          </div>
        </ScrollArea>
      </div>
    </div>
  );
}
