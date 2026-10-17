"use client";

import type { Id } from "@v1/backend/convex/_generated/dataModel";
import { ConditionAssessmentPanel } from "./condition-assessment-panel";
import { ObjectIncidents } from "./object-incidents";

interface ConditionTabProps {
  collectionId: Id<"collections">;
  organizationId: Id<"organizations">;
}

export function ConditionTab({
  collectionId,
  organizationId,
}: ConditionTabProps) {
  return (
    <div className="space-y-8">
      <ConditionAssessmentPanel collectionId={collectionId} />
      <ObjectIncidents
        collectionId={collectionId}
        organizationId={organizationId}
      />
    </div>
  );
}
