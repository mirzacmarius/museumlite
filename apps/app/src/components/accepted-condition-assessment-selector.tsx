"use client";

import { api } from "@v1/backend/convex/_generated/api";
import type { Id } from "@v1/backend/convex/_generated/dataModel";
import { Button } from "@v1/ui/button";
import { usePaginatedQuery } from "convex/react";
import { useClientDate } from "@/hooks/use-client-date-format";
import { useCurrentLocale, useScopedI18n } from "@/locales/client";

interface AcceptedConditionAssessmentSelectorProps {
  collectionId: Id<"collections">;
  value: string;
  onValueChange: (value: string) => void;
  disabled?: boolean;
  /** Lets a `<Label htmlFor>` name the control instead of its default name. */
  id?: string;
  "aria-invalid"?: boolean;
  "aria-describedby"?: string;
}

export function AcceptedConditionAssessmentSelector({
  collectionId,
  value,
  onValueChange,
  disabled,
  id,
  ...aria
}: AcceptedConditionAssessmentSelectorProps) {
  const locale = useCurrentLocale();
  const t = useScopedI18n("conditionAssessments");
  const { results, status, loadMore } = usePaginatedQuery(
    api.conditionAssessments.listForObject,
    { collectionId },
    { initialNumItems: 25 },
  );
  const acceptedAssessments: typeof results = [];
  for (const assessment of results) {
    if (assessment.status === "accepted") {
      acceptedAssessments.push(assessment);
    }
  }
  return (
    <div className="space-y-2">
      <select
        id={id}
        aria-label={id ? undefined : t("selectAccepted")}
        {...aria}
        value={value}
        onChange={(event) => onValueChange(event.target.value)}
        disabled={disabled || status === "LoadingFirstPage"}
        className="min-h-9 w-full rounded-md border border-input bg-background p-2 text-sm"
      >
        <option value="">{t("selectAccepted")}</option>
        {acceptedAssessments.map((assessment) => (
          <AcceptedAssessmentOption
            key={assessment._id}
            assessment={assessment}
            locale={locale}
          />
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

function AcceptedAssessmentOption({
  assessment,
  locale,
}: {
  assessment: {
    _id: string;
    assessedAt: number;
    condition: string;
    summary: string;
  };
  locale: string;
}) {
  const assessedOn = useClientDate(assessment.assessedAt, locale);
  return (
    <option value={assessment._id}>
      {assessedOn} · {assessment.condition} · {assessment.summary}
    </option>
  );
}
