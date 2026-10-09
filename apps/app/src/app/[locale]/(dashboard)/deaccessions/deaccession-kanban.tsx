"use client";

import { api } from "@v1/backend/convex/_generated/api";
import type { Id } from "@v1/backend/convex/_generated/dataModel";
import { useQuery } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import { useScopedI18n } from "@/locales/client";
import { KanbanColumnSkeleton } from "../accessions/kanban-column-skeleton";
import {
  type DeaccessionBoardColumn,
  DeaccessionKanbanColumn,
} from "./deaccession-kanban-column";

type DeaccessionKanbanProps = {
  organizationId: Id<"organizations">;
  search: string;
  status: "all" | "pending" | "approved" | "rejected";
  counts?: FunctionReturnType<typeof api.deaccessions.getBoardCounts>;
  returnPath: string;
};

interface VisibleColumn {
  key: string;
  column: DeaccessionBoardColumn;
  name: string;
  roleName?: string;
  total?: number;
}

export function DeaccessionKanban({
  organizationId,
  search,
  status,
  counts,
  returnPath,
}: DeaccessionKanbanProps) {
  const t = useScopedI18n("deaccessions");
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

  const stepCounts = new Map(
    counts?.columns.map((entry) => [entry.stepNumber, entry.count]),
  );
  const columns: VisibleColumn[] = [];
  if (status === "rejected") {
    columns.push({
      key: "rejected",
      column: { kind: "rejected" },
      name: t("status.rejected"),
      total: counts?.rejected,
    });
  }
  for (const step of workflowSteps.steps) {
    const isApprovedColumn = step.stepNumber === -1;
    if (
      isApprovedColumn
        ? status !== "all" && status !== "approved"
        : status !== "all" && status !== "pending"
    ) {
      continue;
    }
    columns.push({
      key: `${step.stepNumber}-${step.name}`,
      column: isApprovedColumn
        ? { kind: "approved" }
        : { kind: "step", step: step.stepNumber },
      name: step.name,
      roleName: "roleName" in step ? step.roleName : undefined,
      total: isApprovedColumn
        ? counts?.approved
        : stepCounts.get(step.stepNumber),
    });
  }

  return (
    <div className="custom-scrollbar flex-1 overflow-x-auto">
      <div className="flex h-full min-w-max gap-6 pb-4">
        {columns.map((entry) => (
          <DeaccessionKanbanColumn
            key={entry.key}
            organizationId={organizationId}
            column={entry.column}
            roleName={entry.roleName}
            search={search}
            stepName={entry.name}
            total={entry.total}
            returnPath={returnPath}
          />
        ))}
      </div>
    </div>
  );
}
