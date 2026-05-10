"use client";

import { api } from "@v1/backend/convex/_generated/api";
import type { Id } from "@v1/backend/convex/_generated/dataModel";
import { useQuery } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import { Suspense } from "react";
import { KanbanColumn } from "./kanban-column";
import { KanbanColumnSkeleton } from "./kanban-column-skeleton";

type WorkflowStep = {
  stepNumber: number;
  name: string;
  roleName?: string;
};

type AccessionKanbanProps = {
  accessions: FunctionReturnType<typeof api.accessions.list>;
  organizationId: Id<"organizations">;
  searchQuery: string;
};

export function AccessionKanban({
  accessions,
  organizationId,
  searchQuery,
}: AccessionKanbanProps) {
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

  return (
    <div className="flex-1 overflow-x-auto custom-scrollbar">
      <div className="flex h-full min-w-max gap-6 pb-4">
        {workflowSteps.steps.map((step: WorkflowStep) => (
          <Suspense
            key={`${step.stepNumber}-${step.name}`}
            fallback={<KanbanColumnSkeleton />}
          >
            <KanbanColumn
              stepNumber={step.stepNumber}
              stepName={step.name}
              roleName={step.roleName}
              searchQuery={searchQuery}
              accessions={accessions}
            />
          </Suspense>
        ))}
      </div>
    </div>
  );
}
