"use client";

import type { api } from "@v1/backend/convex/_generated/api";
import { cn } from "@v1/ui/utils";
import type { FunctionReturnType } from "convex/server";
import Link from "next/link";
import { useI18n, useScopedI18n } from "@/locales/client";
import { formatConditionLabel } from "../objects/[id]/_components/condition-display";
import { CARD_CLASS_NAME } from "./my-work-sections";

export const PENDING_CONDITION_APPROVALS_HREF =
  "/condition-assessments?status=pending";

type PendingAssessment = Extract<
  FunctionReturnType<typeof api.workBoard.get>[number],
  { key: "conditionApprovals" }
>["cards"][number];

/** Submitted condition assessments waiting for the viewer to accept them. */
export function PendingConditionCards({
  assessments,
}: {
  assessments: PendingAssessment[];
}) {
  const t = useScopedI18n("conditionAssessments.board");
  const translate = useI18n();

  return (
    <ul className="flex flex-col gap-2">
      {assessments.map((assessment) => (
        <li key={assessment._id}>
          <Link
            // Reviewers accept or reject on the board; the object's view
            // page is read-only for anyone who may edit it.
            href={PENDING_CONDITION_APPROVALS_HREF}
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
  );
}
