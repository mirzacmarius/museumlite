"use client";

import { api } from "@v1/backend/convex/_generated/api";
import type { Id } from "@v1/backend/convex/_generated/dataModel";
import { useQuery } from "convex/react";

export function useExhibitionParticipantScheduleConflicts(
  participants: Array<{ collectionId?: string }>,
  startDate: Date,
  endDate: Date | undefined,
  excludeExhibitionId?: Id<"exhibitions">,
) {
  const collectionIds: Id<"collections">[] = [];
  const seen = new Set<string>();
  for (const participant of participants) {
    const collectionId = participant.collectionId;
    if (!collectionId || seen.has(collectionId)) {
      continue;
    }
    seen.add(collectionId);
    collectionIds.push(collectionId as Id<"collections">);
  }

  return useQuery(
    api.exhibitions.checkScheduleConflictsForParticipants,
    collectionIds.length > 0
      ? {
          collectionIds,
          startDate: startDate.getTime(),
          endDate: endDate?.getTime(),
          excludeExhibitionId,
        }
      : "skip",
  );
}
