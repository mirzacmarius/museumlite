"use client";

import { api } from "@v1/backend/convex/_generated/api";
import type { Id } from "@v1/backend/convex/_generated/dataModel";
import { Button } from "@v1/ui/button";
import { DatePickerInput } from "@v1/ui/date-picker";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@v1/ui/dialog";
import { Input } from "@v1/ui/input";
import { Label } from "@v1/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@v1/ui/select";
import { Textarea } from "@v1/ui/textarea";
import { useMutation } from "convex/react";
import { useState } from "react";
import { toast } from "sonner";
import { CurrencyInput, isCurrencyCode } from "@/components/currency-input";
import { useValuationErrorMessage } from "@/hooks/use-valuation-error-message";
import {
  formatDateInputValue,
  parseDateInputValue,
} from "@/lib/account-holder";
import { futureCalendarEndMonth } from "@/lib/format-date";
import { useScopedI18n } from "@/locales/client";

export const APPRAISAL_PURPOSES = [
  "insurance",
  "replacement",
  "market",
  "fair_market",
  "liquidation",
] as const;

export type AppraisalPurpose = (typeof APPRAISAL_PURPOSES)[number];

export interface AppraisalDefaults {
  purpose: AppraisalPurpose;
  value: number;
  currency: string;
  appraisalDate: number;
  appraiserName: string;
  appraiserCompany?: string;
  appraiserCredentials?: string;
  validUntil?: number;
  notes?: string;
}

interface AppraisalFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  collectionId: Id<"collections">;
  /** When set, the form records a correction that supersedes this appraisal. */
  supersedes?: { appraisalId: Id<"appraisals">; defaults: AppraisalDefaults };
}

export function AppraisalFormDialog({
  open,
  onOpenChange,
  collectionId,
  supersedes,
}: AppraisalFormDialogProps) {
  const t = useScopedI18n("valuation");
  const errorMessage = useValuationErrorMessage();
  const create = useMutation(api.appraisals.create);
  const supersede = useMutation(api.appraisals.supersede);
  const defaults = supersedes?.defaults;
  const [form, setForm] = useState({
    purpose: defaults?.purpose ?? ("insurance" as AppraisalPurpose),
    value: defaults ? String(defaults.value) : "",
    currency: defaults?.currency ?? "",
    appraisalDate: formatDateInputValue(defaults?.appraisalDate),
    validUntil: formatDateInputValue(defaults?.validUntil),
    appraiserName: defaults?.appraiserName ?? "",
    appraiserCompany: defaults?.appraiserCompany ?? "",
    appraiserCredentials: defaults?.appraiserCredentials ?? "",
    notes: defaults?.notes ?? "",
    reason: "",
  });
  const [isSaving, setIsSaving] = useState(false);
  const [endMonth] = useState(futureCalendarEndMonth);
  const update = (patch: Partial<typeof form>) =>
    setForm((previous) => ({ ...previous, ...patch }));

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    const value = Number.parseFloat(form.value);
    const appraisalDate = parseDateInputValue(form.appraisalDate);
    if (
      !form.appraiserName.trim() ||
      appraisalDate === undefined ||
      (supersedes && !form.reason.trim())
    ) {
      toast.error(t("requiredFields"));
      return;
    }
    if (!Number.isFinite(value) || value < 0) {
      toast.error(t("invalidValue"));
      return;
    }
    if (!isCurrencyCode(form.currency)) {
      toast.error(t("invalidCurrency"));
      return;
    }
    const validUntil = form.validUntil
      ? Date.parse(form.validUntil)
      : undefined;
    const facts = {
      appraisalType: form.purpose,
      value,
      currency: form.currency.trim(),
      appraisalDate,
      validUntil,
      appraiserName: form.appraiserName.trim(),
      appraiserCompany: form.appraiserCompany.trim() || undefined,
      appraiserCredentials: form.appraiserCredentials.trim() || undefined,
      notes: form.notes.trim() || undefined,
    };
    setIsSaving(true);
    try {
      if (supersedes) {
        await supersede({
          appraisalId: supersedes.appraisalId,
          reason: form.reason.trim(),
          ...facts,
        });
        toast.success(t("superseded"));
      } else {
        await create({ collectionId, ...facts });
        toast.success(t("recorded"));
      }
      onOpenChange(false);
    } catch (error) {
      toast.error(errorMessage(error, t("failed")));
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[560px]">
        <DialogHeader>
          <DialogTitle>
            {supersedes ? t("supersedeTitle") : t("recordTitle")}
          </DialogTitle>
          <DialogDescription>
            {supersedes ? t("supersedeDescription") : t("recordDescription")}
          </DialogDescription>
        </DialogHeader>
        <form className="space-y-4" onSubmit={handleSubmit}>
          {supersedes ? (
            <div className="space-y-2">
              <Label htmlFor="appraisal-reason">{t("reason")}</Label>
              <Textarea
                id="appraisal-reason"
                value={form.reason}
                placeholder={t("reasonPlaceholder")}
                onChange={(event) => update({ reason: event.target.value })}
              />
            </div>
          ) : null}
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="appraisal-purpose">{t("purpose")}</Label>
              <Select
                value={form.purpose}
                onValueChange={(purpose) =>
                  update({ purpose: purpose as AppraisalPurpose })
                }
              >
                <SelectTrigger id="appraisal-purpose">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {APPRAISAL_PURPOSES.map((purpose) => (
                    <SelectItem key={purpose} value={purpose}>
                      {t(`purposes.${purpose}`)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <DatePickerInput
              id="appraisal-date"
              label={t("appraisalDate")}
              value={form.appraisalDate}
              onChange={(appraisalDate) => update({ appraisalDate })}
            />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="appraisal-value">{t("value")}</Label>
              <Input
                id="appraisal-value"
                type="number"
                min="0"
                step="any"
                value={form.value}
                onChange={(event) => update({ value: event.target.value })}
              />
            </div>
            <CurrencyInput
              id="appraisal-currency"
              label={t("currency")}
              hint={t("currencyHint")}
              value={form.currency}
              onChange={(currency) => update({ currency })}
            />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="appraiser-name">{t("appraiserName")}</Label>
              <Input
                id="appraiser-name"
                value={form.appraiserName}
                onChange={(event) =>
                  update({ appraiserName: event.target.value })
                }
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="appraiser-company">{t("appraiserCompany")}</Label>
              <Input
                id="appraiser-company"
                value={form.appraiserCompany}
                onChange={(event) =>
                  update({ appraiserCompany: event.target.value })
                }
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="appraiser-credentials">
              {t("appraiserCredentials")}
            </Label>
            <Input
              id="appraiser-credentials"
              value={form.appraiserCredentials}
              onChange={(event) =>
                update({ appraiserCredentials: event.target.value })
              }
            />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <DatePickerInput
              id="appraisal-valid-until"
              endMonth={endMonth}
              label={t("validUntil")}
              value={form.validUntil}
              onChange={(validUntil) => update({ validUntil })}
            />
            <div className="space-y-2">
              <Label htmlFor="appraisal-notes">{t("notes")}</Label>
              <Input
                id="appraisal-notes"
                value={form.notes}
                onChange={(event) => update({ notes: event.target.value })}
              />
            </div>
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
