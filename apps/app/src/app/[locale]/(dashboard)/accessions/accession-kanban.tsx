"use client";

import { api } from "@v1/backend/convex/_generated/api";
import type { Id } from "@v1/backend/convex/_generated/dataModel";
import { useQuery } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import { parseAsString, useQueryState } from "nuqs";
import { Suspense } from "react";
import { KanbanColumn } from "./kanban-column";
import { KanbanColumnSkeleton } from "./kanban-column-skeleton";

type WorkflowStep = {
  stepNumber: number;
  name: string;
  roleName?: string;
};

type AccessionKanbanProps = {
  organizationId: Id<"organizations">;
  searchQuery: string;
  columnCounts?: FunctionReturnType<
    typeof api.accessions.getBoardCounts
  >["columns"];
};

export function AccessionKanban({
  organizationId,
  searchQuery,
  columnCounts,
}: AccessionKanbanProps) {
  const [statusFilter] = useQueryState("status", parseAsString.withDefault(""));
  const workflowSteps = useQuery(api.accessions.getWorkflowSteps, {
    organizationId,
  });

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

  const visibleSteps: WorkflowStep[] = [];
  for (const step of workflowSteps.steps) {
    if (statusFilter !== "pending" || step.stepNumber !== -1) {
      visibleSteps.push(step);
    }
  }

  return (
    <div className="flex-1 overflow-x-auto custom-scrollbar">
      <div className="flex h-full min-w-max gap-6 pb-4">
        {visibleSteps.map((step) => (
          <Suspense
            key={`${step.stepNumber}-${step.name}`}
            fallback={<KanbanColumnSkeleton />}
          >
            <KanbanColumn
              organizationId={organizationId}
              stepNumber={step.stepNumber}
              stepName={step.name}
              roleName={step.roleName}
              searchQuery={searchQuery}
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
