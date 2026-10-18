"use client";

import type { api } from "@v1/backend/convex/_generated/api";
import { cn } from "@v1/ui/utils";
import type { FunctionReturnType } from "convex/server";
import Link from "next/link";
import { useI18n } from "@/locales/client";
import { CARD_CLASS_NAME } from "./my-work-sections";

export const TRANSFERS_HREF = "/accessions/transfers";

type PendingTransfer = Extract<
  FunctionReturnType<typeof api.workBoard.get>[number],
  { key: "transfers" }
>["cards"][number];

/**
 * Transfers waiting on the viewer's organization: outgoing ones to approve
 * and incoming ones to accept. When more wait, it links to all of them.
 */
export function PendingTransferCards({
  transfers,
  hasMore,
}: {
  transfers: PendingTransfer[];
  hasMore: boolean;
}) {
  const t = useI18n();
  return (
    <div className="space-y-2">
      <ul className="flex flex-col gap-2">
        {transfers.map((request) => (
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
                {request.direction === "incoming"
                  ? t(
                      "untranslatedRecords.accessions.transfers.awaitingAcceptance",
                    )
                  : t(
                      "untranslatedRecords.accessions.transfers.pendingApproval",
                    )}
              </span>
            </Link>
          </li>
        ))}
      </ul>
      {hasMore ? (
        <Link
          href={TRANSFERS_HREF}
          className="block px-1 text-xs text-muted-foreground transition-colors hover:text-foreground"
        >
          {t("common.viewAll")}
        </Link>
      ) : null}
    </div>
  );
}
