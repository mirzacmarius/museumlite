"use client";

import type { Id } from "@v1/backend/convex/_generated/dataModel";
import { ObjectComments } from "./object-comments";

interface CommentsTabProps {
  collectionId: Id<"collections">;
  organizationId: Id<"organizations">;
}

export function CommentsTab({
  collectionId,
  organizationId,
}: CommentsTabProps) {
  return (
    <div className="space-y-6">
      <ObjectComments objectId={collectionId} organizationId={organizationId} />
    </div>
  );
}
