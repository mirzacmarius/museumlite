"use client";

import { DatePicker } from "@v1/ui/date-picker";
import { Input } from "@v1/ui/input";
import { Label } from "@v1/ui/label";
import { Banknote, Calendar } from "lucide-react";
import { LoanCurrencyInput } from "@/components/loan-currency-input";
import { useI18n, useScopedI18n } from "@/locales/client";
import type { EditLoanFormData } from "./types";

interface EditLoanScheduleSectionProps {
  formData: EditLoanFormData;
  onChange: (updates: Partial<EditLoanFormData>) => void;
}

export function EditLoanScheduleSection({
  formData,
  onChange,
}: EditLoanScheduleSectionProps) {
  const tRoot = useI18n();
  const t = useScopedI18n("loans.placeholders");

  return (
    <div className="rounded-xl border border-border bg-card p-6 shadow-sm">
      <h2 className="text-sm font-semibold uppercase tracking-widest text-muted-foreground mb-6 flex items-center gap-2">
        <Calendar className="size-4" />
        {tRoot("loans.actions.scheduleValue")}
      </h2>

      <div className="grid gap-6 md:grid-cols-2">
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
            onChange({ startDate: date ?? formData.startDate })
          }
          placeholder={t("selectStartDate")}
        />

        <DatePicker
          label={tRoot("loans.actions.endDate")}
          id="endDate"
          date={formData.endDate}
          onSelect={(date: Date | undefined) => onChange({ endDate: date })}
          placeholder={t("selectEndDate")}
        />

        <div className="grid grid-cols-[1fr_8rem] items-start gap-4 md:col-span-2">
          <div className="space-y-2">
            <Label htmlFor="insuranceValue">
              {tRoot("loans.actions.insuranceValue")}
            </Label>
            <div className="relative">
              <Banknote className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                id="insuranceValue"
                type="number"
                step="0.01"
                value={formData.insuranceValue}
                onChange={(e) => onChange({ insuranceValue: e.target.value })}
                placeholder="0.00"
                className="pl-9 bg-background"
              />
            </div>
          </div>
          <LoanCurrencyInput
            id="currency"
            value={formData.currency}
            onChange={(currency) => onChange({ currency })}
          />
        </div>
      </div>
    </div>
  );
}
