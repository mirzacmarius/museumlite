"use client";

import { api } from "@v1/backend/convex/_generated/api";
import type { Id } from "@v1/backend/convex/_generated/dataModel";
import { useQuery } from "convex/react";
import { Suspense } from "react";
import { KanbanColumnSkeleton } from "../accessions/kanban-column-skeleton";
import { DeaccessionKanbanColumn } from "./deaccession-kanban-column";

export interface DeaccessionKanbanItem {
  _id: Id<"deaccessions">;
  deaccessionNumber: string;
  collectionId: Id<"collections">;
  collectionTitle: string;
  accessionNumber?: string;
  dateDeaccessioned: number;
  reason: string;
  method: "sale" | "donation" | "destruction" | "transfer";
  targetCollectionStatus: "deaccessioned" | "archived" | "deleted";
  status: "pending" | "approved" | "rejected";
  workflowStep?: number;
}

type DeaccessionKanbanProps = {
  organizationId: Id<"organizations">;
  searchQuery: string;
  deaccessions: { page: DeaccessionKanbanItem[] };
};

type WorkflowStep = {
  stepNumber: number;
  name: string;
  roleName?: string;
};

export function DeaccessionKanban({
  organizationId,
  searchQuery,
  deaccessions,
}: DeaccessionKanbanProps) {
  const workflowSteps = useQuery(api.deaccessions.getWorkflowSteps, {
    organizationId,
  });

  if (workflowSteps === undefined) {
    return (
      <div className="custom-scrollbar flex-1 overflow-x-auto">
        <div className="flex h-full min-w-max gap-6 pb-4">
          <KanbanColumnSkeleton />
          <KanbanColumnSkeleton />
          <KanbanColumnSkeleton />
        </div>
      </div>
    );
  }

  return (
    <div className="custom-scrollbar flex-1 overflow-x-auto">
      <div className="flex h-full min-w-max gap-6 pb-4">
        {workflowSteps.steps.map((step: WorkflowStep) => (
          <Suspense
            key={`${step.stepNumber}-${step.name}`}
            fallback={<KanbanColumnSkeleton />}
          >
            <DeaccessionKanbanColumn
              deaccessions={deaccessions}
              roleName={step.roleName}
              searchQuery={searchQuery}
              stepName={step.name}
              stepNumber={step.stepNumber}
            />
          </Suspense>
        ))}
      </div>
    </div>
  );
}
