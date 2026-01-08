"use client";

import { useQuery } from "convex/react";
import type { Id } from "@v1/backend/convex/_generated/dataModel";
import { api } from "@v1/backend/convex/_generated/api";
import { ScrollArea } from "@v1/ui/scroll-area";
import { CheckCircle, Clock, FileEdit, Search, User } from "lucide-react";
import Link from "next/link";

type WorkflowStage = "draft" | "review" | "cataloging" | "approved";

type KanbanColumnProps = {
  organizationId: Id<"organizations">;
  stage: WorkflowStage;
  searchQuery: string;
  preloadedAccessions: unknown;
};

const stageToStep: Record<WorkflowStage, number> = {
  draft: 0,
  review: 1,
  cataloging: 2,
  approved: 3,
};

const stageConfig: Record<
  WorkflowStage,
  { label: string; color: string; icon: React.ReactNode }
> = {
  draft: {
    label: "Draft",
    color: "bg-zinc-500",
    icon: <FileEdit className="h-4 w-4" />,
  },
  review: {
    label: "In Review",
    color: "bg-amber-500",
    icon: <Clock className="h-4 w-4" />,
  },
  cataloging: {
    label: "Cataloging",
    color: "bg-blue-500",
    icon: <Search className="h-4 w-4" />,
  },
  approved: {
    label: "Approved",
    color: "bg-emerald-500",
    icon: <CheckCircle className="h-4 w-4" />,
  },
};

export function KanbanColumn({
  organizationId,
  stage,
  searchQuery,
  preloadedAccessions,
}: KanbanColumnProps) {
  const accessions = useQuery(api.accessions.list, {
    organizationId,
    paginationOpts: { numItems: 100, cursor: null },
  });

  const config = stageConfig[stage];

  const stepNumber = stageToStep[stage];
  const filteredAccessions =
    accessions?.page?.filter((a) => {
      const currentStep = a.workflowStep ?? 0;
      const matchesStage = currentStep === stepNumber;
      const matchesSearch = searchQuery
        ? a.accessionNumber
            ?.toLowerCase()
            .includes(searchQuery.toLowerCase()) ||
          a.source?.toLowerCase().includes(searchQuery.toLowerCase())
        : true;
      return matchesStage && matchesSearch;
    }) ?? [];

  return (
    <div className="flex w-72 flex-shrink-0 flex-col">
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div
            className={`rounded p-1 ${config.color}/20 text-${config.color.replace("bg-", "")}`}
          >
            {config.icon}
          </div>
          <span className="text-sm font-medium text-foreground">
            {config.label}
          </span>
        </div>
        <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
          {filteredAccessions.length}
        </span>
      </div>

      <div className="flex-1 rounded-xl border border-border bg-card">
        <ScrollArea className="h-full max-h-[calc(100vh-280px)]">
          <div className="flex flex-col gap-2 p-2">
            {filteredAccessions.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 text-center">
                <div className="text-muted-foreground">{config.icon}</div>
                <p className="mt-2 text-xs text-muted-foreground">
                  No accessions in {config.label.toLowerCase()}
                </p>
              </div>
            ) : (
              filteredAccessions.map((accession) => (
                <Link
                  key={accession._id}
                  href={`/accessions/${accession._id}`}
                  className="group rounded-lg border border-border bg-muted p-3 transition-all hover:border-border hover:bg-accent/50"
                >
                  <div className="mb-1 flex items-center justify-between">
                    <span className="text-xs font-medium text-muted-foreground">
                      {accession.accessionNumber}
                    </span>
                    <div className={`h-2 w-2 rounded-full ${config.color}`} />
                  </div>
                  <p className="mb-2 text-sm font-medium text-foreground line-clamp-2">
                    {accession.source || "Unknown source"}
                  </p>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <User className="h-3 w-3" />
                    <span>{accession.method}</span>
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
