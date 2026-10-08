"use client";

import { api } from "@v1/backend/convex/_generated/api";
import type { Id } from "@v1/backend/convex/_generated/dataModel";
import { Button } from "@v1/ui/button";
import { usePaginatedQuery } from "convex/react";
import { useCurrentLocale, useScopedI18n } from "@/locales/client";

interface AcceptedConditionAssessmentSelectorProps {
  collectionId: Id<"collections">;
  value: string;
  onValueChange: (value: string) => void;
  disabled?: boolean;
}

export function AcceptedConditionAssessmentSelector({
  collectionId,
  value,
  onValueChange,
  disabled,
}: AcceptedConditionAssessmentSelectorProps) {
  const locale = useCurrentLocale();
  const t = useScopedI18n("conditionAssessments");
  const { results, status, loadMore } = usePaginatedQuery(
    api.conditionAssessments.listForObject,
    { collectionId },
    { initialNumItems: 25 },
  );
  return (
    <div className="space-y-2">
      <select
        aria-label={t("selectAccepted")}
        value={value}
        onChange={(event) => onValueChange(event.target.value)}
        disabled={disabled || status === "LoadingFirstPage"}
        className="w-full rounded-md border border-border bg-background p-2 text-sm"
      >
        <option value="">{t("selectAccepted")}</option>
        {results
          .filter((assessment) => assessment.status === "accepted")
          .map((assessment) => (
            <option key={assessment._id} value={assessment._id}>
              {new Date(assessment.assessedAt).toLocaleDateString(locale)} ·{" "}
              {assessment.condition} · {assessment.summary}
            </option>
          ))}
      </select>
      {status === "CanLoadMore" ? (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => loadMore(25)}
          disabled={disabled}
        >
          {t("moreHistory")}
        </Button>
      ) : null}
    </div>
  );
}
