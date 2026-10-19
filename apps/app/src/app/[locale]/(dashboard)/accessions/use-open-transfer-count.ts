"use client";

import { api } from "@v1/backend/convex/_generated/api";
import type { Id } from "@v1/backend/convex/_generated/dataModel";
import { useQuery } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import { usePermissions } from "@/components/permission-gate";

type TransferRequest = FunctionReturnType<
  typeof api.objectMoves.listForOrganization
>[number];

/**
 * Outgoing transfers waiting for this organization's approval: the Transfers
 * board's Pending column. Legacy `pending` requests arrive normalized.
 */
export function countPendingTransfers(
  requests: readonly TransferRequest[],
): number {
  return requests.filter(
    (request) =>
      request.status === "pending_source_approval" &&
      request.direction === "outgoing",
  ).length;
}

/** Incoming transfers waiting for this organization to accept or decline. */
export function countIncomingTransfers(
  requests: readonly TransferRequest[],
): number {
  return requests.filter(
    (request) =>
      request.status === "awaiting_acceptance" &&
      request.direction === "incoming",
  ).length;
}

/**
 * The Transfers tab count on every accessions view, independent of the
 * board's search: outgoing transfers waiting for approval plus incoming ones
 * waiting for acceptance, the board's Pending and Incoming columns. "-" while
 * loading and for members who cannot review transfers.
 */
export function useOpenTransferCount(
  organizationId: Id<"organizations">,
): number | "-" {
  const { hasPermission, isLoading } = usePermissions();
  const canReviewTransfers =
    !isLoading && hasPermission("organization.manage_settings");
  const requests = useQuery(
    api.objectMoves.listForOrganization,
    canReviewTransfers ? { organizationId } : "skip",
  );
  return requests
    ? countPendingTransfers(requests) + countIncomingTransfers(requests)
    : "-";
}
