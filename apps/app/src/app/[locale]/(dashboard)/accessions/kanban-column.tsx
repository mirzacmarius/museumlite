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

const DEFAULT_DOT_STYLE = "bg-slate-500 shadow-[0_0_8px_rgba(100,116,139,0.5)]";

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
      const isApproved = a.status === "approved";

      const matchesStep =
        stepNumber === -1
          ? isApproved
          : !isApproved && currentStep === stepNumber;

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
      <div className="flex items-center justify-between text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-2">
        <span>
          {stepName}
          {roleName && <span className="ml-1 opacity-70">({roleName})</span>}
        </span>
        <span className="bg-zinc-800 text-zinc-500 px-1.5 py-0.5 rounded text-[10px]">
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
              filteredAccessions.map(
                (accession: AccessionItem, index: number) => (
                  <Link
                    key={accession._id}
                    href={`/accessions/${accession._id}`}
                    className="bg-zinc-900 border border-zinc-800 p-3 rounded-lg hover:border-zinc-700 transition-colors cursor-pointer group animate-enter block"
                    style={{ animationDelay: `${Math.min(index * 50, 300)}ms` }}
                  >
                    <div className="flex justify-between items-start mb-2">
                      <span className="text-[10px] font-mono text-zinc-500">
                        {accession.accessionNumber}
                      </span>
                      <div className={`w-1.5 h-1.5 rounded-full ${dotStyle}`} />
                    </div>
                    <p className="text-sm text-zinc-200 font-medium mb-1 group-hover:text-indigo-400 transition-colors line-clamp-2">
                      {accession.draftTitle || accession.source || t("kanban.unknownSource")}
                    </p>
                    <p className="text-xs text-zinc-500 mb-3 line-clamp-2">
                      {accession.draftTitle ? accession.source : accession.method}
                    </p>
                    {accession.assigneeName && (
                      <div className="flex items-center gap-2">
                        <div className="w-5 h-5 rounded-full bg-indigo-500/20 flex items-center justify-center text-[9px] text-indigo-300">
                          {getInitials(accession.assigneeName)}
                        </div>
                        <span className="text-[10px] text-zinc-400">
                          {accession.assigneeName}
                        </span>
                      </div>
                    )}
                  </Link>
                ),
              )
            )}
          </div>
        </ScrollArea>
      </div>
    </div>
  );
}
