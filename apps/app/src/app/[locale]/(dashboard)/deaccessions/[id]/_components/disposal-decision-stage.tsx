"use client";

import { api } from "@v1/backend/convex/_generated/api";
import type { Doc } from "@v1/backend/convex/_generated/dataModel";
import { Button } from "@v1/ui/button";
import { Label } from "@v1/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@v1/ui/select";
import { useMutation, useQuery } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import { CheckCircle, Circle, MinusCircle, ShieldAlert } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { ClientDateFns } from "@/components/client-date";
import { usePermissions } from "@/components/permission-gate";
import { useValuationErrorMessage } from "@/hooks/use-valuation-error-message";
import { formatMoney } from "@/lib/format-number";
import { useCurrentLocale, useScopedI18n } from "@/locales/client";
import { disposalStageErrorMessage } from "./disposal-stage-error";

type DisposalStages = NonNullable<
  FunctionReturnType<typeof api.deaccessions.getDisposalStages>
>;

const CHECK_KEYS = [
  "reason",
  "disposition",
  "valuation",
  "regulatory_approval",
] as const;
type CheckKey = (typeof CHECK_KEYS)[number];

function isCheckKey(key: string): key is CheckKey {
  return CHECK_KEYS.some((known) => known === key);
}

export function DisposalDecisionStage({
  deaccession,
  stages,
  locale,
}: {
  deaccession: Doc<"deaccessions">;
  stages: DisposalStages;
  locale: string;
}) {
  const t = useScopedI18n("deaccessions.stages");
  const { decision } = stages;
  const waived = new Set(decision.exception?.waivedCheckKeys ?? []);

  const basisLabel = {
    pending: t("decision.pending"),
    rejected: t("decision.rejected"),
    policy_checked: t("decision.policyChecked"),
    authorized_exception: t("decision.authorizedException"),
    legacy: t("decision.legacy"),
  }[decision.basis];

  const checkLabel = (key: CheckKey) =>
    ({
      reason: t("checks.reason"),
      disposition: t("checks.disposition"),
      valuation: t("checks.valuation"),
      regulatory_approval: t("checks.regulatoryApproval"),
    })[key];

  return (
    <div className="rounded-2xl border border-border/60 bg-background/40 p-4">
      <h3 className="text-sm font-semibold">{t("decision.title")}</h3>
      <p className="mt-1 text-xs text-muted-foreground">{basisLabel}</p>

      {decision.basis === "legacy" ? (
        <p className="mt-3 text-sm text-muted-foreground">
          {t("decision.legacyDescription")}
        </p>
      ) : (
        <ul className="mt-3 space-y-2">
          {decision.checks.map((check) => {
            if (!isKnownCheck(check)) return null;
            const isWaived = waived.has(check.key);
            const Icon = !check.required
              ? MinusCircle
              : check.passed
                ? CheckCircle
                : isWaived
                  ? ShieldAlert
                  : Circle;
            return (
              <li key={check.key} className="flex items-start gap-2 text-sm">
                <Icon
                  aria-hidden
                  className={
                    check.passed && check.required
                      ? "mt-0.5 h-4 w-4 text-emerald-400"
                      : "mt-0.5 h-4 w-4 text-muted-foreground"
                  }
                />
                <span>
                  {checkLabel(check.key)}
                  <span className="sr-only">
                    {" "}
                    {!check.required
                      ? t("decision.notRequired")
                      : check.passed
                        ? t("decision.passed")
                        : isWaived
                          ? t("decision.waived")
                          : t("decision.outstanding")}
                  </span>
                  {!check.required ? (
                    <span className="ml-1 text-xs text-muted-foreground">
                      ({t("decision.notRequired")})
                    </span>
                  ) : isWaived ? (
                    <span className="ml-1 text-xs text-muted-foreground">
                      ({t("decision.waived")})
                    </span>
                  ) : null}
                </span>
              </li>
            );
          })}
        </ul>
      )}

      {decision.checkedAt ? (
        <p className="mt-3 text-xs text-muted-foreground">
          {t("decision.checkedAt")}{" "}
          <ClientDateFns
            timestamp={decision.checkedAt}
            format="MMM d, yyyy"
            locale={locale}
          />
        </p>
      ) : null}

      {decision.exception ? (
        <div className="mt-3 rounded-xl border border-border/60 p-3 text-sm">
          <p className="text-xs text-muted-foreground">
            {t("decision.exceptionBy", {
              name: decision.exception.authorizedByName ?? t("unknownUser"),
            })}
          </p>
          <p className="mt-1 whitespace-pre-wrap">
            {decision.exception.reason}
          </p>
        </div>
      ) : null}

      <DisposalValuation deaccession={deaccession} stages={stages} />
    </div>
  );
}

function isKnownCheck(check: {
  key: string;
  required: boolean;
  passed: boolean;
}): check is { key: CheckKey; required: boolean; passed: boolean } {
  return isCheckKey(check.key);
}

function DisposalValuation({
  deaccession,
  stages,
}: {
  deaccession: Doc<"deaccessions">;
  stages: DisposalStages;
}) {
  const t = useScopedI18n("deaccessions.stages");
  const tValuation = useScopedI18n("valuation");
  const valuationErrorMessage = useValuationErrorMessage();
  const locale = useCurrentLocale();
  const { hasPermission } = usePermissions();
  const canLink =
    stages.decision.basis === "pending" && hasPermission("collections.update");
  const appraisals = useQuery(api.appraisals.listByCollection, {
    collectionId: deaccession.collectionId,
  });
  const linkAppraisal = useMutation(api.deaccessions.linkAppraisal);
  const [selectedId, setSelectedId] = useState<string>("");
  const [isLinking, setIsLinking] = useState(false);

  const linked = appraisals?.find(
    (appraisal) => appraisal._id === stages.valuation.linkedAppraisalId,
  );
  const linkable = appraisals?.filter((appraisal) => !appraisal.isSuperseded);

  const handleLink = async () => {
    const appraisal = linkable?.find((entry) => entry._id === selectedId);
    if (!appraisal) return;
    setIsLinking(true);
    try {
      const result = await linkAppraisal({
        deaccessionId: deaccession._id,
        appraisalId: appraisal._id,
      });
      if (result.valid) toast.success(t("valuation.linkedToast"));
      else toast.warning(t("valuation.tooOld"));
      setSelectedId("");
    } catch (error) {
      toast.error(
        valuationErrorMessage(
          error,
          disposalStageErrorMessage(error, t("actionFailed")),
        ),
      );
    } finally {
      setIsLinking(false);
    }
  };

  return (
    <div className="mt-4 border-t border-border/60 pt-3">
      <p className="text-xs font-medium">{t("valuation.title")}</p>
      <p className="mt-1 text-sm text-muted-foreground">
        {linked
          ? t("valuation.linked", {
              value: formatMoney(linked.value, locale, linked.currency),
              appraiser: linked.appraiserName,
            })
          : t("valuation.none")}
        {linked && !stages.valuation.isCurrent ? (
          <span className="ml-1">({t("valuation.notCurrent")})</span>
        ) : null}
      </p>
      {canLink && linkable !== undefined ? (
        linkable.length === 0 ? (
          <p className="mt-2 text-xs text-muted-foreground">
            {t("valuation.noAppraisals")}
          </p>
        ) : (
          <div className="mt-2 flex flex-col items-start gap-2">
            <div className="w-full min-w-0">
              <Label htmlFor="disposal-valuation" className="sr-only">
                {t("valuation.select")}
              </Label>
              <Select value={selectedId} onValueChange={setSelectedId}>
                <SelectTrigger id="disposal-valuation">
                  <SelectValue placeholder={t("valuation.select")} />
                </SelectTrigger>
                <SelectContent>
                  {linkable.map((appraisal) => (
                    <SelectItem key={appraisal._id} value={appraisal._id}>
                      {formatMoney(appraisal.value, locale, appraisal.currency)}{" "}
                      · {tValuation(`purposes.${appraisal.appraisalType}`)} ·{" "}
                      {appraisal.appraiserName} ·{" "}
                      {t("valuation.ageDays", { days: appraisal.ageDays })}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button
              size="sm"
              onClick={handleLink}
              disabled={!selectedId || isLinking}
            >
              {isLinking ? t("valuation.linking") : t("valuation.link")}
            </Button>
          </div>
        )
      ) : null}
    </div>
  );
}
