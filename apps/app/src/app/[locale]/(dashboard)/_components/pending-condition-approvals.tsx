"use client";

import { api } from "@v1/backend/convex/_generated/api";
import type { Id } from "@v1/backend/convex/_generated/dataModel";
import { Button } from "@v1/ui/button";
import { cn } from "@v1/ui/utils";
import { usePaginatedQuery, useQuery } from "convex/react";
import { Stethoscope } from "lucide-react";
import Link from "next/link";
import { usePermissions } from "@/components/permission-gate";
import { useI18n, useScopedI18n } from "@/locales/client";
import { formatConditionLabel } from "../objects/[id]/_components/condition-display";
import { CARD_CLASS_NAME } from "./my-work-sections";
import type { WorkColumn } from "./work-board";

export const PENDING_CONDITION_APPROVALS_HREF =
  "/condition-assessments?status=pending";
const PAGE_SIZE = 20;

/**
 * Condition assessments awaiting the viewer's approval as a My work column.
 * Null for members who cannot accept assessments, so they never see it.
 */
export function usePendingConditionApprovalColumn(
  organizationId: Id<"organizations">,
): WorkColumn | null {
  const t = useScopedI18n("conditionAssessments");
  const { hasPermission } = usePermissions();
  const canAccept = hasPermission("collections.accept_condition");
  const pending = useQuery(
    api.conditionAssessments.pendingApprovalCount,
    canAccept ? { organizationId } : "skip",
  );
  if (!canAccept) return null;

  const summary = {
    key: "conditionApprovals",
    icon: Stethoscope,
    accentClassName: "text-pink-400",
    title: t("pendingApprovalCard"),
    count: pending?.count ?? 0,
    hasMore: pending?.hasMore ?? false,
  };
  return {
    ...summary,
    loading: pending === undefined,
    renderCards: () => (
      <PendingConditionCards organizationId={organizationId} />
    ),
    summaryEntries: [{ ...summary, href: PENDING_CONDITION_APPROVALS_HREF }],
  };
}

function PendingConditionCards({
  organizationId,
}: {
  organizationId: Id<"organizations">;
}) {
  const t = useScopedI18n("conditionAssessments.board");
  const tWork = useScopedI18n("caseTasks.myWork");
  const translate = useI18n();
  const { results, status, loadMore } = usePaginatedQuery(
    api.conditionAssessments.listBoardColumn,
    { organizationId, column: "submitted" },
    { initialNumItems: PAGE_SIZE },
  );

  return (
    <div className="space-y-2">
      <ul className="flex flex-col gap-2">
        {results.map((assessment) => (
          <li key={assessment._id}>
            <Link
              href={`/objects/${assessment.collectionId}?tab=physical`}
              className={cn(CARD_CLASS_NAME, "flex-col gap-0.5")}
            >
              <span className="w-full truncate text-sm font-medium text-foreground">
                {assessment.objectTitle ?? t("objectUnavailable")}
              </span>
              <span className="w-full truncate text-[11px] text-muted-foreground">
                {formatConditionLabel(assessment.condition, translate)}
                {" · "}
                {t("assessedBy", {
                  name: assessment.assessorName ?? t("unknownPerson"),
                })}
              </span>
            </Link>
          </li>
        ))}
      </ul>
      {status === "CanLoadMore" ? (
        <Button
          size="sm"
          variant="ghost"
          className="w-full"
          onClick={() => loadMore(PAGE_SIZE)}
        >
          {tWork("loadMore")}
        </Button>
      ) : null}
    </div>
  );
}
