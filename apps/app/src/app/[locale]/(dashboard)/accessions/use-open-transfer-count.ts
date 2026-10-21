"use client";

import { api } from "@v1/backend/convex/_generated/api";
import type { Id } from "@v1/backend/convex/_generated/dataModel";
import { useQuery } from "convex/react";

/**
 * The Transfers tab count on every accessions view, independent of the
 * board's search: the transfers waiting on this organization's decision, as
 * the backend counts them. "-" while loading and for members who cannot
 * decide transfers.
 */
export function useOpenTransferCount(
  organizationId: Id<"organizations">,
): number | "-" {
  const counts = useQuery(api.objectMoves.getBoardCounts, { organizationId });
  return counts?.awaitingDecision ?? "-";
}
