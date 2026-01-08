"use client";

import { Suspense } from "react";
import { useQuery, useMutation } from "convex/react";
import type { Id } from "@v1/backend/convex/_generated/dataModel";
import { api } from "@v1/backend/convex/_generated/api";
import { ScrollArea } from "@v1/ui/scroll-area";
import { CheckCircle, GripVertical, User } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { KanbanColumnSkeleton } from "./kanban-column-skeleton";
import { KanbanColumn } from "./kanban-column";

type WorkflowStage = "draft" | "review" | "cataloging" | "approved";

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
  return (
    <div className="flex-1 overflow-x-auto px-6">
      <div className="flex h-full min-w-max gap-6 pb-4">
        <Suspense fallback={<KanbanColumnSkeleton />}>
          <KanbanColumn
            organizationId={organizationId}
            stage="draft"
            searchQuery={searchQuery}
            preloadedAccessions={preloadedAccessions}
          />
        </Suspense>
        <Suspense fallback={<KanbanColumnSkeleton />}>
          <KanbanColumn
            organizationId={organizationId}
            stage="review"
            searchQuery={searchQuery}
            preloadedAccessions={preloadedAccessions}
          />
        </Suspense>
        <Suspense fallback={<KanbanColumnSkeleton />}>
          <KanbanColumn
            organizationId={organizationId}
            stage="cataloging"
            searchQuery={searchQuery}
            preloadedAccessions={preloadedAccessions}
          />
        </Suspense>
        <Suspense fallback={<KanbanColumnSkeleton />}>
          <KanbanColumn
            organizationId={organizationId}
            stage="approved"
            searchQuery={searchQuery}
            preloadedAccessions={preloadedAccessions}
          />
        </Suspense>
      </div>
    </div>
  );
}
