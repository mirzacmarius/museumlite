"use client";

import { DatePicker } from "@v1/ui/date-picker";
import { Input } from "@v1/ui/input";
import { Label } from "@v1/ui/label";
import { Textarea } from "@v1/ui/textarea";
import { useState } from "react";
import { LoanCurrencyInput } from "@/components/loan-currency-input";
import { futureCalendarEndMonth } from "@/lib/format-date";
import { useI18n, useScopedI18n } from "@/locales/client";
import type { NewLoanFormData } from "./types";

interface NewLoanScheduleSectionProps {
  formData: NewLoanFormData;
  onFormDataChange: (
    updater: (prev: NewLoanFormData) => NewLoanFormData,
  ) => void;
}

export function NewLoanScheduleSection({
  formData,
  onFormDataChange,
}: NewLoanScheduleSectionProps) {
  const tRoot = useI18n();
  const t = useScopedI18n("loans");
  // Loans run into later years, beyond the calendar's default last month.
  const [endMonth] = useState(futureCalendarEndMonth);

  return (
    <div className="rounded-xl border border-border bg-card p-6 shadow-sm">
      <h2 className="text-sm font-semibold uppercase tracking-widest text-muted-foreground mb-6 flex items-center gap-2">
        <span className="flex size-5 items-center justify-center rounded-full bg-muted text-[10px] text-foreground">
          2
        </span>
        {tRoot("loans.actions.scheduleTerms")}
      </h2>

      <div className="grid gap-6">
        <div className="grid grid-cols-2 gap-4">
          <DatePicker
            label={
              <>
                {tRoot("loans.actions.startDate")}{" "}
                <span className="text-destructive">*</span>
              </>
            }
            id="startDate"
            date={formData.startDate}
            onSelect={(date: Date | undefined) =>
              onFormDataChange((prev) => ({
                ...prev,
                startDate: date ?? prev.startDate,
              }))
            }
            placeholder={t("placeholders.selectDate")}
            endMonth={endMonth}
          />
          <DatePicker
            label={tRoot("loans.actions.endDate")}
            id="endDate"
            date={formData.endDate}
            onSelect={(date: Date | undefined) =>
              onFormDataChange((prev) => ({ ...prev, endDate: date }))
            }
            placeholder={t("placeholders.selectDate")}
            endMonth={endMonth}
          />
        </div>

        <div className="grid grid-cols-[1fr_8rem] items-start gap-4">
          <div className="space-y-2">
            <Label htmlFor="insuranceValue">
              {tRoot("untranslatedRecords.loans.detail.totalInsuranceValue")}
            </Label>
            <Input
              id="insuranceValue"
              type="number"
              step="0.01"
              value={formData.insuranceValue}
              onChange={(e) =>
                onFormDataChange((prev) => ({
                  ...prev,
                  insuranceValue: e.target.value,
                }))
              }
              placeholder={t("placeholders.insuranceValue")}
              className="bg-background"
            />
          </div>
          <LoanCurrencyInput
            id="currency"
            value={formData.currency}
            onChange={(currency) =>
              onFormDataChange((prev) => ({ ...prev, currency }))
            }
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="terms">
            {tRoot("loans.actions.termsConditions")}
          </Label>
          <Textarea
            id="terms"
            value={formData.terms}
            onChange={(e) =>
              onFormDataChange((prev) => ({
                ...prev,
                terms: e.target.value,
              }))
            }
            placeholder={t("placeholders.terms")}
            rows={3}
            className="bg-background resize-none"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="notes">{tRoot("loans.actions.internalNotes")}</Label>
          <Textarea
            id="notes"
            value={formData.notes}
            onChange={(e) =>
              onFormDataChange((prev) => ({
                ...prev,
                notes: e.target.value,
              }))
            }
            placeholder={t("placeholders.notes")}
            rows={2}
            className="bg-background resize-none"
          />
        </div>
      </div>
    </div>
  );
}
