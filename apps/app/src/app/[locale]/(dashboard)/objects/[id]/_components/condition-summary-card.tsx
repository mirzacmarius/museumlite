"use client";

import { api } from "@v1/backend/convex/_generated/api";
import type { Id } from "@v1/backend/convex/_generated/dataModel";
import { Button } from "@v1/ui/button";
import { cn } from "@v1/ui/utils";
import { useQuery } from "convex/react";
import { ChevronDown, HeartPulse } from "lucide-react";
import { useI18n, useScopedI18n } from "@/locales/client";
import { formatConditionLabel } from "./condition-display";
import { DetailSection } from "./detail-section";

/**
 * The object's current condition at a glance, with a toggle that expands the
 * full assessment history below it.
 */
export function ConditionSummaryCard({
  collectionId,
  historyId,
  historyExpanded = false,
  onToggleHistory,
}: {
  collectionId: Id<"collections">;
  historyId?: string;
  historyExpanded?: boolean;
  onToggleHistory?: () => void;
}) {
  const t = useScopedI18n("conditionAssessments");
  const translate = useI18n();
  const detail = useQuery(api.conditionAssessments.getForObject, {
    collectionId,
  });

  return (
    <DetailSection
      title={t("current")}
      icon={HeartPulse}
      bodyClassName="space-y-3"
    >
      {detail === undefined ? (
        <p className="text-sm text-muted-foreground" role="status">
          {t("loading")}
        </p>
      ) : (
        <>
          <div>
            <p className="break-words text-lg font-semibold text-foreground">
              {detail.current.condition
                ? formatConditionLabel(detail.current.condition, translate)
                : t("unknown")}
            </p>
            {detail.current.source === "assessment" ? (
              <p className="text-xs text-muted-foreground">
                {t("acceptedSource")}
              </p>
            ) : detail.current.source === "legacy" ? (
              <p className="text-xs text-muted-foreground">
                {t("legacyUncertain")}
              </p>
            ) : null}
          </div>
          {detail.open ? (
            <p className="w-fit rounded-md border border-status-info/30 bg-status-info/10 px-2 py-1 text-xs font-medium text-status-info-foreground">
              {detail.open.status === "draft"
                ? t("openDraftCaption")
                : t("awaitingApprovalCaption")}
            </p>
          ) : null}
          {onToggleHistory ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="w-fit"
              aria-expanded={historyExpanded}
              aria-controls={historyId}
              onClick={onToggleHistory}
            >
              {t("history")}
              <ChevronDown
                className={cn(
                  "ml-1.5 size-3.5 transition-transform",
                  historyExpanded && "rotate-180",
                )}
                aria-hidden
              />
            </Button>
          ) : null}
        </>
      )}
    </DetailSection>
  );
}
