"use client";

import { api } from "@v1/backend/convex/_generated/api";
import type { Id } from "@v1/backend/convex/_generated/dataModel";
import { type Preloaded, usePreloadedQuery, useQuery } from "convex/react";
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
  preloadedAccessions: Preloaded<typeof api.accessions.list>;
};

export function AccessionKanban({
  organizationId,
  searchQuery,
  preloadedAccessions,
}: AccessionKanbanProps) {
  const workflowSteps = useQuery(api.accessions.getWorkflowSteps, {
    organizationId,
  });
  const accessions = usePreloadedQuery(preloadedAccessions);

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
