"use client";

import { Suspense } from "react";
import { useQuery } from "convex/react";
import type { Id } from "@v1/backend/convex/_generated/dataModel";
import { api } from "@v1/backend/convex/_generated/api";
import { Loader2 } from "lucide-react";
import { KanbanColumnSkeleton } from "./kanban-column-skeleton";
import { KanbanColumn } from "./kanban-column";

type WorkflowStep = {
  stepNumber: number;
  name: string;
  roleName?: string;
};

type AccessionKanbanProps = {
  organizationId: Id<"organizations">;
  searchQuery: string;
  preloadedAccessions: unknown;
};

export function AccessionKanban({
  organizationId,
  searchQuery,
  preloadedAccessions,
}: AccessionKanbanProps) {
  const workflowSteps = useQuery(api.accessions.getWorkflowSteps, {
    organizationId,
  });

  if (workflowSteps === undefined) {
    return (
      <div className="flex-1 overflow-x-auto px-6">
        <div className="flex h-full min-w-max gap-6 pb-4">
          <KanbanColumnSkeleton />
          <KanbanColumnSkeleton />
          <KanbanColumnSkeleton />
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-x-auto px-6">
      <div className="flex h-full min-w-max gap-6 pb-4">
        {workflowSteps.steps.map((step: WorkflowStep) => (
          <Suspense key={step.stepNumber} fallback={<KanbanColumnSkeleton />}>
            <KanbanColumn
              organizationId={organizationId}
              stepNumber={step.stepNumber}
              stepName={step.name}
              roleName={step.roleName}
              searchQuery={searchQuery}
              preloadedAccessions={preloadedAccessions}
            />
          </Suspense>
        ))}
      </div>
    </div>
  );
}
