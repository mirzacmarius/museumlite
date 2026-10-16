"use client";

import { api } from "@v1/backend/convex/_generated/api";
import type { Id } from "@v1/backend/convex/_generated/dataModel";
import { cn } from "@v1/ui/utils";
import { useQuery } from "convex/react";
import { ArrowRightLeft } from "lucide-react";
import Link from "next/link";
import { usePermissions } from "@/components/permission-gate";
import { useI18n, useScopedI18n } from "@/locales/client";
import { CARD_CLASS_NAME } from "./my-work-sections";
import type { WorkColumn } from "./work-board";

const TRANSFERS_HREF = "/accessions/transfers";

/**
 * Transfers waiting on the viewer's organization: outgoing ones to approve
 * and incoming ones to accept. Only members who decide transfers get it.
 */
export function usePendingTransfersColumn(
  organizationId: Id<"organizations">,
): WorkColumn | undefined {
  const t = useScopedI18n("caseTasks");
  const tRoot = useI18n();
  const { hasPermission } = usePermissions();
  const canDecideTransfers = hasPermission("organization.manage_settings");
  const pending = useQuery(
    api.objectMoves.listAwaitingDecision,
    canDecideTransfers ? { organizationId } : "skip",
  );
  if (!canDecideTransfers) return undefined;

  const entry = {
    key: "transfers",
    icon: ArrowRightLeft,
    accentClassName: "text-sky-400",
    title: t("myWork.pendingTransfers"),
    count: pending?.requests.length ?? 0,
    hasMore: pending?.truncated ?? false,
  };
  return {
    ...entry,
    loading: pending === undefined,
    renderCards: () => (
      <ul className="flex flex-col gap-2">
        {pending?.requests.map((request) => (
          <li key={request._id}>
            <Link
              href={`/objects/move-requests/${request._id}`}
              className={cn(CARD_CLASS_NAME, "flex-col gap-0.5")}
            >
              <span className="w-full truncate text-sm font-medium text-foreground">
                {request.collectionTitle ?? request.sourceAccessionNumber}
              </span>
              <span className="w-full truncate text-[11px] text-muted-foreground">
                {request.sourceAccessionNumber}
                {" · "}
                {request.status === "awaiting_acceptance"
                  ? tRoot(
                      "untranslatedRecords.accessions.transfers.awaitingAcceptance",
                    )
                  : tRoot(
                      "untranslatedRecords.accessions.transfers.pendingApproval",
                    )}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    ),
    summaryEntries: [{ ...entry, href: TRANSFERS_HREF }],
  };
}
