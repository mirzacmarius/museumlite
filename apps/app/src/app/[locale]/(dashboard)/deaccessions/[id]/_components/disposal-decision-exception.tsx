"use client";

import { api } from "@v1/backend/convex/_generated/api";
import type { Id } from "@v1/backend/convex/_generated/dataModel";
import { Label } from "@v1/ui/label";
import { Textarea } from "@v1/ui/textarea";
import { useQuery } from "convex/react";
import { useScopedI18n } from "@/locales/client";

/**
 * Lists outstanding decision checks before approval. Approving the final
 * decision with outstanding checks requires an exception reason, which the
 * backend retains and audits.
 */
export function DisposalDecisionException({
  deaccessionId,
  exceptionReason,
  setExceptionReason,
  disabled,
}: {
  deaccessionId: Id<"deaccessions">;
  exceptionReason: string;
  setExceptionReason: (value: string) => void;
  disabled: boolean;
}) {
  const t = useScopedI18n("deaccessions.stages");
  const stages = useQuery(api.deaccessions.getDisposalStages, {
    deaccessionId,
  });

  if (!stages?.appliesToDisposal || stages.decision.ready) return null;

  const labels: Record<string, string> = {
    reason: t("checks.reason"),
    disposition: t("checks.disposition"),
    valuation: t("checks.valuation"),
    regulatory_approval: t("checks.regulatoryApproval"),
  };
  const outstanding = stages.decision.checks.filter(
    (check) => check.required && !check.passed,
  );

  return (
    <div className="space-y-2 rounded-xl border border-border/60 p-3">
      <p className="text-sm font-medium">{t("approval.outstanding")}</p>
      <ul className="list-disc space-y-1 pl-5 text-sm text-muted-foreground">
        {outstanding.map((check) => (
          <li key={check.key}>{labels[check.key] ?? check.key}</li>
        ))}
      </ul>
      <Label htmlFor="disposal-exception-reason">
        {t("approval.exceptionReason")}
      </Label>
      <Textarea
        id="disposal-exception-reason"
        value={exceptionReason}
        onChange={(event) => setExceptionReason(event.target.value)}
        rows={3}
        disabled={disabled}
        className="resize-none border-border/70 bg-background/70"
      />
      <p className="text-xs text-muted-foreground">
        {t("approval.exceptionHint")}
      </p>
    </div>
  );
}
