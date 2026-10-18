"use client";

import { api } from "@v1/backend/convex/_generated/api";
import type { Id } from "@v1/backend/convex/_generated/dataModel";
import { Button } from "@v1/ui/button";
import { useQuery } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import { ArrowLeft } from "lucide-react";
import { parseAsString, useQueryState } from "nuqs";
import { Suspense } from "react";
import { useScopedI18n } from "@/locales/client";
import { KanbanColumn } from "./kanban-column";
import { KanbanColumnSkeleton } from "./kanban-column-skeleton";

type WorkflowStep = {
  stepNumber: number;
  name: string;
  roleName?: string;
};

type BoardCounts = FunctionReturnType<typeof api.accessions.getBoardCounts>;

type AccessionKanbanProps = {
  organizationId: Id<"organizations">;
  searchQuery: string;
  columnCounts?: BoardCounts["columns"];
  withdrawnCount?: number;
  returnPath: string;
};

export function AccessionKanban({
  organizationId,
  searchQuery,
  columnCounts,
  withdrawnCount,
  returnPath,
}: AccessionKanbanProps) {
  const t = useScopedI18n("accessionReview.board");
  const [statusFilter, setStatusFilter] = useQueryState(
    "status",
    parseAsString.withDefault(""),
  );
  const workflowSteps = useQuery(api.accessions.getWorkflowSteps, {
    organizationId,
  });

  if (statusFilter === "withdrawn") {
    return (
      <div className="flex flex-1 flex-col gap-3 overflow-x-auto custom-scrollbar">
        <div>
          <Button
            variant="ghost"
            size="sm"
            className="text-xs"
            onClick={() => void setStatusFilter(null)}
          >
            <ArrowLeft className="mr-2 size-4" />
            {t("showActive")}
          </Button>
        </div>
        <div className="flex h-full min-w-max gap-6 pb-4">
          <Suspense fallback={<KanbanColumnSkeleton />}>
            <KanbanColumn
              organizationId={organizationId}
              column={{ kind: "withdrawn" }}
              stepName={t("withdrawn")}
              searchQuery={searchQuery}
              returnPath={returnPath}
              total={withdrawnCount}
            />
          </Suspense>
        </div>
      </div>
    );
  }

  if (workflowSteps === undefined) {
    return (
      <div className="flex-1 overflow-x-auto custom-scrollbar">
        <div className="flex h-full min-w-max gap-6 pb-4">
          <KanbanColumnSkeleton />
          <KanbanColumnSkeleton />
          <KanbanColumnSkeleton />
        </div>
      </div>
    );
  }

  // Every column shows, Approved included, whichever link opened the board.
  const steps: WorkflowStep[] = workflowSteps.steps;

  return (
    <div className="flex-1 overflow-x-auto custom-scrollbar">
      <div className="flex h-full min-w-max gap-6 pb-4">
        {steps.map((step) => (
          <Suspense
            key={`${step.stepNumber}-${step.name}`}
            fallback={<KanbanColumnSkeleton />}
          >
            <KanbanColumn
              organizationId={organizationId}
              column={
                step.stepNumber === -1
                  ? { kind: "approved" }
                  : { kind: "step", step: step.stepNumber }
              }
              stepName={step.name}
              roleName={step.roleName}
              searchQuery={searchQuery}
              returnPath={returnPath}
              total={
                columnCounts?.find(
                  (column) => column.stepNumber === step.stepNumber,
                )?.count
              }
            />
          </Suspense>
        ))}
      </div>
    </div>
  );
}
