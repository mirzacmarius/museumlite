"use client";

import { api } from "@v1/backend/convex/_generated/api";
import type { Id } from "@v1/backend/convex/_generated/dataModel";
import { Badge } from "@v1/ui/badge";
import { Button } from "@v1/ui/button";
import { Checkbox } from "@v1/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@v1/ui/dialog";
import { Input } from "@v1/ui/input";
import { Label } from "@v1/ui/label";
import { RadioGroup, RadioGroupItem } from "@v1/ui/radio-group";
import { Textarea } from "@v1/ui/textarea";
import { useMutation, useQuery } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import { useState } from "react";
import { toast } from "sonner";
import { ClientDate } from "@/components/client-date";
import { CurrencyInput, isCurrencyCode } from "@/components/currency-input";
import { PermissionGate } from "@/components/permission-gate";
import { useValuationErrorMessage } from "@/hooks/use-valuation-error-message";
import { useScopedI18n } from "@/locales/client";
import { MoneyCell } from "./money-cell";

type Review = FunctionReturnType<
  typeof api.insuranceCoverageReviews.list
>["reviews"][number];
type TargetKind = Review["targets"][number]["kind"];

export function LegacyCoverageReviewTab({
  organizationId,
  locale,
}: {
  organizationId: Id<"organizations">;
  locale: string;
}) {
  const t = useScopedI18n("untranslatedDashboard.insurance.review");
  const tCoverage = useScopedI18n(
    "untranslatedDashboard.insurance.coverageTab",
  );
  const tInsurance = useScopedI18n("untranslatedDashboard.insurance");
  const [status, setStatus] = useState<"open" | "resolved">("open");
  const [resolving, setResolving] = useState<Review | null>(null);
  const queue = useQuery(api.insuranceCoverageReviews.list, {
    organizationId,
    status,
  });

  return (
    <div className="space-y-4">
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-start">
        <div className="space-y-1">
          <h3 className="text-sm font-semibold text-foreground">
            {t("title")}
          </h3>
          <p className="max-w-2xl text-xs text-muted-foreground">
            {t("description")}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {queue ? (
            <Badge variant="outline">
              {t("openCount", { count: queue.openCount })}
            </Badge>
          ) : null}
          <Button
            variant="outline"
            size="sm"
            onClick={() => setStatus(status === "open" ? "resolved" : "open")}
          >
            {status === "open" ? t("showResolved") : t("showOpen")}
          </Button>
        </div>
      </div>

      {queue === undefined ? (
        <div className="h-32 w-full animate-pulse rounded-xl bg-card/40" />
      ) : queue.reviews.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          {status === "open" ? t("empty") : t("emptyResolved")}
        </p>
      ) : (
        <ul className="space-y-3">
          {queue.reviews.map((review) => (
            <li
              key={review._id}
              className="space-y-3 rounded-xl border border-border/60 bg-card/40 p-4"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="space-y-1">
                  <p className="font-medium text-foreground">
                    {tInsurance("policy")} {review.policyNumber}
                  </p>
                  <div className="text-sm">
                    <span className="text-muted-foreground">
                      {t("value")}:{" "}
                    </span>
                    <MoneyCell
                      value={review.coveredValue}
                      currency={review.coverageCurrency}
                      locale={locale}
                      notRecordedLabel={tInsurance("currencyNotRecorded")}
                    />
                  </div>
                </div>
                {review.status === "open" ? (
                  <PermissionGate permission="organization.manage_settings">
                    <Button size="sm" onClick={() => setResolving(review)}>
                      {t("resolve")}
                    </Button>
                  </PermissionGate>
                ) : null}
              </div>
              <div>
                <p className="text-[10px] uppercase tracking-widest text-muted-foreground">
                  {t("targets")}
                </p>
                <ul className="mt-1 space-y-1 text-sm">
                  {review.targets.map((target) => (
                    <li key={target.id}>
                      <span className="text-muted-foreground">
                        {tCoverage(`targetKinds.${target.kind}`)}:
                      </span>{" "}
                      {target.reference
                        ? `${target.reference} · ${target.label}`
                        : target.label}
                    </li>
                  ))}
                </ul>
              </div>
              {review.resolution ? (
                <p className="text-xs text-muted-foreground">
                  {t("resolvedSummary", {
                    target: tCoverage(
                      `targetKinds.${review.resolution.keptTarget}`,
                    ),
                    count: review.resolution.createdCoverageIds.length,
                  })}{" "}
                  · {review.resolution.resolvedByName ?? ""}{" "}
                  <ClientDate
                    timestamp={review.resolution.resolvedAt}
                    locale={locale}
                  />
                  {review.resolution.note ? ` · ${review.resolution.note}` : ""}
                </p>
              ) : null}
            </li>
          ))}
        </ul>
      )}
      {queue?.truncated ? (
        <p className="text-xs text-muted-foreground">{t("truncated")}</p>
      ) : null}

      {resolving ? (
        <ResolveReviewDialog
          review={resolving}
          onClose={() => setResolving(null)}
        />
      ) : null}
    </div>
  );
}

function ResolveReviewDialog({
  review,
  onClose,
}: {
  review: Review;
  onClose: () => void;
}) {
  const t = useScopedI18n("untranslatedDashboard.insurance.review");
  const tCoverage = useScopedI18n(
    "untranslatedDashboard.insurance.coverageTab",
  );
  const tValuation = useScopedI18n("valuation");
  const errorMessage = useValuationErrorMessage();
  const resolve = useMutation(api.insuranceCoverageReviews.resolve);
  const [keep, setKeep] = useState<TargetKind>(
    review.targets[0]?.kind ?? "object",
  );
  const [currency, setCurrency] = useState(
    review.coverageCurrency ?? review.policyCurrency ?? "",
  );
  const [split, setSplit] = useState<
    Partial<Record<TargetKind, { coveredValue: string; currency: string }>>
  >({});
  const [note, setNote] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const others = review.targets.filter((target) => target.kind !== keep);
  const describe = (target: Review["targets"][number]) =>
    target.reference ? `${target.reference} · ${target.label}` : target.label;

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    const entries = others.flatMap((target) => {
      const entry = split[target.kind];
      return entry ? [{ kind: target.kind, ...entry }] : [];
    });
    if (currency && !isCurrencyCode(currency)) {
      toast.error(tValuation("invalidCurrency"));
      return;
    }
    for (const entry of entries) {
      const value = Number.parseFloat(entry.coveredValue);
      if (!Number.isFinite(value) || value < 0) {
        toast.error(tValuation("invalidValue"));
        return;
      }
      if (!isCurrencyCode(entry.currency)) {
        toast.error(tValuation("invalidCurrency"));
        return;
      }
    }
    setIsSaving(true);
    try {
      await resolve({
        reviewId: review._id,
        keep,
        currency: currency.trim() || undefined,
        split: entries.map((entry) => ({
          kind: entry.kind,
          coveredValue: Number.parseFloat(entry.coveredValue),
          currency: entry.currency.trim(),
        })),
        note: note.trim() || undefined,
      });
      toast.success(t("resolved"));
      onClose();
    } catch (error) {
      toast.error(errorMessage(error, t("failed")));
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Dialog open onOpenChange={(open) => (open ? null : onClose())}>
      <DialogContent className="sm:max-w-[560px]">
        <DialogHeader>
          <DialogTitle>{t("resolveTitle")}</DialogTitle>
          <DialogDescription>{t("resolveDescription")}</DialogDescription>
        </DialogHeader>
        <form className="space-y-5" onSubmit={handleSubmit}>
          <fieldset className="space-y-2">
            <legend className="text-sm font-medium">{t("keep")}</legend>
            <RadioGroup
              value={keep}
              onValueChange={(value) => setKeep(value as TargetKind)}
            >
              {review.targets.map((target) => (
                <div key={target.id} className="flex items-center gap-2">
                  <RadioGroupItem
                    id={`keep-${target.kind}`}
                    value={target.kind}
                  />
                  <Label htmlFor={`keep-${target.kind}`}>
                    {tCoverage(`targetKinds.${target.kind}`)}:{" "}
                    {describe(target)}
                  </Label>
                </div>
              ))}
            </RadioGroup>
          </fieldset>

          <CurrencyInput
            id="review-currency"
            label={t("currency")}
            hint={t("currencyHint")}
            value={currency}
            onChange={setCurrency}
          />

          {others.map((target) => {
            const entry = split[target.kind];
            return (
              <div
                key={target.id}
                className="space-y-3 rounded-lg border border-border/60 p-3"
              >
                <div className="flex items-center gap-2">
                  <Checkbox
                    id={`split-${target.kind}`}
                    checked={entry !== undefined}
                    onCheckedChange={(checked) =>
                      setSplit((previous) => ({
                        ...previous,
                        [target.kind]: checked
                          ? { coveredValue: "", currency }
                          : undefined,
                      }))
                    }
                  />
                  <Label htmlFor={`split-${target.kind}`}>
                    {t("addSplit", { target: describe(target) })}
                  </Label>
                </div>
                {entry ? (
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor={`split-value-${target.kind}`}>
                        {t("splitValue")}
                      </Label>
                      <Input
                        id={`split-value-${target.kind}`}
                        type="number"
                        min="0"
                        step="any"
                        value={entry.coveredValue}
                        onChange={(event) =>
                          setSplit((previous) => ({
                            ...previous,
                            [target.kind]: {
                              ...entry,
                              coveredValue: event.target.value,
                            },
                          }))
                        }
                      />
                    </div>
                    <CurrencyInput
                      id={`split-currency-${target.kind}`}
                      label={t("splitCurrency")}
                      hint={tValuation("currencyHint")}
                      value={entry.currency}
                      onChange={(value) =>
                        setSplit((previous) => ({
                          ...previous,
                          [target.kind]: { ...entry, currency: value },
                        }))
                      }
                    />
                  </div>
                ) : null}
              </div>
            );
          })}

          <div className="space-y-2">
            <Label htmlFor="review-note">{t("note")}</Label>
            <Textarea
              id="review-note"
              value={note}
              onChange={(event) => setNote(event.target.value)}
            />
          </div>

          <div className="flex justify-end">
            <Button type="submit" disabled={isSaving}>
              {isSaving ? t("saving") : t("save")}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
