"use client";

import { useQuery } from "convex/react";
import type { Id } from "@v1/backend/convex/_generated/dataModel";
import { api } from "@v1/backend/convex/_generated/api";
import { ScrollArea } from "@v1/ui/scroll-area";
import {
  CheckCircle,
  Clock,
  FileEdit,
  Search,
  ShieldCheck,
  User,
} from "lucide-react";
import Link from "next/link";

type AccessionItem = {
  _id: Id<"accessions">;
  accessionNumber: string;
  source: string;
  method: string;
  status: "pending" | "approved" | "rejected";
  workflowStep?: number;
  assignedTo?: Id<"users">;
  assigneeName?: string;
};

type KanbanColumnProps = {
  organizationId: Id<"organizations">;
  stepNumber: number;
  stepName: string;
  roleName?: string;
  searchQuery: string;
  preloadedAccessions: unknown;
};

const stepColors: Record<number, string> = {
  0: "bg-zinc-500",
  1: "bg-amber-500",
  2: "bg-blue-500",
  3: "bg-purple-500",
  4: "bg-indigo-500",
  [-1]: "bg-emerald-500",
};

function getStepColor(stepNumber: number): string {
  return stepColors[stepNumber] || stepColors[stepNumber % 5] || "bg-zinc-500";
}

function getStepIcon(stepNumber: number) {
  if (stepNumber === 0) return <FileEdit className="h-4 w-4" />;
  if (stepNumber === -1) return <CheckCircle className="h-4 w-4" />;
  if (stepNumber === 1) return <Clock className="h-4 w-4" />;
  if (stepNumber === 2) return <Search className="h-4 w-4" />;
  return <ShieldCheck className="h-4 w-4" />;
}

export function KanbanColumn({
  organizationId,
  stepNumber,
  stepName,
  roleName,
  searchQuery,
}: KanbanColumnProps) {
  const accessions = useQuery(api.accessions.list, {
    organizationId,
    paginationOpts: { numItems: 100, cursor: null },
  });

  const color = getStepColor(stepNumber);
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
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className={`rounded p-1 ${color}/20`}>{icon}</div>
          <div>
            <span className="text-sm font-medium text-foreground">
              {stepName}
            </span>
            {roleName && (
              <span className="ml-2 text-xs text-muted-foreground">
                ({roleName})
              </span>
            )}
          </div>
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
                <div className="text-muted-foreground">{icon}</div>
                <p className="mt-2 text-xs text-muted-foreground">
                  No accessions in {stepName.toLowerCase()}
                </p>
              </div>
            ) : (
              filteredAccessions.map((accession: AccessionItem) => (
                <Link
                  key={accession._id}
                  href={`/accessions/${accession._id}`}
                  className="group rounded-lg border border-border bg-muted p-3 transition-all hover:border-border hover:bg-accent/50"
                >
                  <div className="mb-1 flex items-center justify-between">
                    <span className="text-xs font-medium text-muted-foreground">
                      {accession.accessionNumber}
                    </span>
                    <div className={`h-2 w-2 rounded-full ${color}`} />
                  </div>
                  <p className="mb-2 text-sm font-medium text-foreground line-clamp-2">
                    {accession.source || "Unknown source"}
                  </p>
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <div className="flex items-center gap-1">
                      <span className="capitalize">{accession.method}</span>
                    </div>
                    {accession.assigneeName && (
                      <div className="flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5">
                        <User className="h-3 w-3 text-primary" />
                        <span className="text-primary">
                          {accession.assigneeName}
                        </span>
                      </div>
                    )}
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
