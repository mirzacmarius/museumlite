"use client";

import { api } from "@v1/backend/convex/_generated/api";
import type { Id } from "@v1/backend/convex/_generated/dataModel";
import { Button } from "@v1/ui/button";
import { DatePickerInput } from "@v1/ui/date-picker";
import { Input } from "@v1/ui/input";
import { Label } from "@v1/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@v1/ui/select";
import { useMutation, useQuery } from "convex/react";
import { useState } from "react";
import { toast } from "sonner";
import { ClientDate } from "@/components/client-date";
import { CurrencyInput, isCurrencyCode } from "@/components/currency-input";
import { ObjectCombobox } from "@/components/object-combobox";
import { useValuationErrorMessage } from "@/hooks/use-valuation-error-message";
import { parseDateInputValue } from "@/lib/account-holder";
import {
  CALENDAR_DATE_OPTIONS,
  futureCalendarEndMonth,
} from "@/lib/format-date";
import { useScopedI18n } from "@/locales/client";

export interface CoveragePolicyOption {
  value: Id<"insurancePolicies">;
  label: string;
  currency?: string;
  effectiveDate: number;
  expirationDate: number;
}

type TargetKind = "object" | "loan" | "exhibition";

const TARGET_KINDS: TargetKind[] = ["object", "loan", "exhibition"];

function coverageTarget(kind: TargetKind, id: string) {
  switch (kind) {
    case "object":
      return { kind, collectionId: id as Id<"collections"> };
    case "loan":
      return { kind, loanId: id as Id<"loans"> };
    case "exhibition":
      return { kind, exhibitionId: id as Id<"exhibitions"> };
  }
}

export function CoverageForm({
  organizationId,
  locale,
  policies,
  onDone,
}: {
  organizationId: Id<"organizations">;
  locale: string;
  policies: CoveragePolicyOption[];
  onDone: () => void;
}) {
  const t = useScopedI18n("untranslatedDashboard.insurance.coverageTab");
  const tInsurance = useScopedI18n("untranslatedDashboard.insurance");
  const tValuation = useScopedI18n("valuation");
  const errorMessage = useValuationErrorMessage();
  const addCoverage = useMutation(api.insurance.addCoverage);
  const [form, setForm] = useState({
    policyId: "",
    kind: "object" as TargetKind,
    targetId: "",
    coveredValue: "",
    currency: "",
    effectiveDate: "",
    expirationDate: "",
  });
  const [isSaving, setIsSaving] = useState(false);
  const [endMonth] = useState(futureCalendarEndMonth);
  const update = (patch: Partial<typeof form>) =>
    setForm((previous) => ({ ...previous, ...patch }));
  const options = useQuery(
    api.insurance.listCoverageTargetOptions,
    form.kind === "object" ? "skip" : { organizationId, kind: form.kind },
  );
  const policy = policies.find((option) => option.value === form.policyId);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    const coveredValue = Number.parseFloat(form.coveredValue);
    if (!policy || !form.targetId || Number.isNaN(coveredValue)) {
      toast.error(t("requiredFields"));
      return;
    }
    if (coveredValue < 0) {
      toast.error(tValuation("invalidValue"));
      return;
    }
    if (!isCurrencyCode(form.currency)) {
      toast.error(tValuation("invalidCurrency"));
      return;
    }
    const effectiveDate = parseDateInputValue(form.effectiveDate);
    const expirationDate = parseDateInputValue(form.expirationDate);
    setIsSaving(true);
    try {
      await addCoverage({
        policyId: policy.value,
        target: coverageTarget(form.kind, form.targetId),
        coveredValue,
        currency: form.currency.trim(),
        effectiveDate,
        expirationDate,
      });
      toast.success(t("added"));
      onDone();
    } catch (error) {
      toast.error(errorMessage(error, t("failed")));
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <form className="space-y-4" onSubmit={handleSubmit}>
      <div className="space-y-2">
        <Label htmlFor="coverage-policy">{t("policy")}</Label>
        <Select
          value={form.policyId}
          onValueChange={(policyId) =>
            update({
              policyId,
              currency:
                form.currency ||
                (policies.find((option) => option.value === policyId)
                  ?.currency ??
                  ""),
            })
          }
        >
          <SelectTrigger id="coverage-policy">
            <SelectValue placeholder={tInsurance("selectPolicy")} />
          </SelectTrigger>
          <SelectContent>
            {policies.length === 0 ? (
              <SelectItem value="none" disabled>
                {tInsurance("noPoliciesFound")}
              </SelectItem>
            ) : null}
            {policies.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {policy ? (
          <p className="text-xs text-muted-foreground">
            {t("periodHint")}{" "}
            <ClientDate
              timestamp={policy.effectiveDate}
              locale={locale}
              options={CALENDAR_DATE_OPTIONS}
            />{" "}
            –{" "}
            <ClientDate
              timestamp={policy.expirationDate}
              locale={locale}
              options={CALENDAR_DATE_OPTIONS}
            />
          </p>
        ) : null}
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="coverage-kind">{t("targetType")}</Label>
          <Select
            value={form.kind}
            onValueChange={(kind) =>
              update({ kind: kind as TargetKind, targetId: "" })
            }
          >
            <SelectTrigger id="coverage-kind">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {TARGET_KINDS.map((kind) => (
                <SelectItem key={kind} value={kind}>
                  {t(`targetKinds.${kind}`)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="coverage-target">{t("target")}</Label>
          {form.kind === "object" ? (
            <ObjectCombobox
              organizationId={organizationId}
              value={form.targetId || undefined}
              onValueChange={(targetId) => update({ targetId: targetId ?? "" })}
              placeholder={t("selectObject")}
            />
          ) : (
            <Select
              value={form.targetId}
              onValueChange={(targetId) => update({ targetId })}
            >
              <SelectTrigger id="coverage-target">
                <SelectValue
                  placeholder={
                    form.kind === "loan"
                      ? t("selectLoan")
                      : t("selectExhibition")
                  }
                />
              </SelectTrigger>
              <SelectContent>
                {options?.length === 0 ? (
                  <SelectItem value="none" disabled>
                    {t("noOptions")}
                  </SelectItem>
                ) : null}
                {(options ?? []).map((option) => (
                  <SelectItem key={option.id} value={option.id}>
                    {option.reference
                      ? `${option.reference} · ${option.label}`
                      : option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="coverage-value">{t("coveredValue")}</Label>
          <Input
            id="coverage-value"
            type="number"
            min="0"
            step="any"
            value={form.coveredValue}
            onChange={(event) => update({ coveredValue: event.target.value })}
          />
        </div>
        <CurrencyInput
          id="coverage-currency"
          label={tInsurance("currencyRequiredLabel")}
          hint={t("currencyHint")}
          value={form.currency}
          onChange={(currency) => update({ currency })}
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <DatePickerInput
          id="coverage-start"
          endMonth={endMonth}
          label={t("startDate")}
          value={form.effectiveDate}
          onChange={(effectiveDate) => update({ effectiveDate })}
        />
        <DatePickerInput
          id="coverage-end"
          endMonth={endMonth}
          label={t("endDate")}
          value={form.expirationDate}
          onChange={(expirationDate) => update({ expirationDate })}
        />
      </div>

      <div className="flex justify-end">
        <Button type="submit" disabled={isSaving || policies.length === 0}>
          {isSaving ? t("saving") : t("save")}
        </Button>
      </div>
    </form>
  );
}
