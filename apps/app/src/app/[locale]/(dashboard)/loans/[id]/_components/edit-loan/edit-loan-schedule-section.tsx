"use client";

import { DatePicker } from "@v1/ui/date-picker";
import { Input } from "@v1/ui/input";
import { Label } from "@v1/ui/label";
import { Banknote, Calendar } from "lucide-react";
import { LoanCurrencyInput } from "@/components/loan-currency-input";
import {
  FieldError,
  fieldErrorProps,
} from "@/components/record-form/record-form-notices";
import { useI18n, useScopedI18n } from "@/locales/client";
import type { EditLoanFormData } from "./types";

interface EditLoanScheduleSectionProps {
  formData: EditLoanFormData;
  onChange: (updates: Partial<EditLoanFormData>) => void;
  fieldErrors: Record<string, string>;
}

export function EditLoanScheduleSection({
  formData,
  onChange,
  fieldErrors,
}: EditLoanScheduleSectionProps) {
  const tRoot = useI18n();
  const t = useScopedI18n("loans.placeholders");
  const startDate = new Date(formData.startDate);
  const endDate =
    formData.endDate === null ? undefined : new Date(formData.endDate);

  return (
    <div className="rounded-xl border border-border bg-card p-6 shadow-sm">
      <h2 className="text-sm font-semibold uppercase tracking-widest text-muted-foreground mb-6 flex items-center gap-2">
        <Calendar className="size-4" />
        {tRoot("loans.actions.scheduleValue")}
      </h2>

      <div className="grid gap-6 md:grid-cols-2">
        <div className="space-y-2">
          <DatePicker
            label={
              <>
                {tRoot("loans.actions.startDate")}{" "}
                <span className="text-destructive">*</span>
              </>
            }
            id="startDate"
            className="mx-0 w-full sm:w-44"
            date={startDate}
            onSelect={(date: Date | undefined) =>
              onChange({ startDate: date?.getTime() ?? formData.startDate })
            }
            placeholder={t("selectStartDate")}
          />
          <FieldError field="startDate" message={fieldErrors.startDate} />
        </div>

        <div className="space-y-2">
          <DatePicker
            label={tRoot("loans.actions.endDate")}
            id="endDate"
            className="mx-0 w-full sm:w-44"
            date={endDate}
            onSelect={(date: Date | undefined) =>
              onChange({ endDate: date?.getTime() ?? null })
            }
            placeholder={t("selectEndDate")}
          />
          <FieldError field="endDate" message={fieldErrors.endDate} />
        </div>

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
                min="0"
                value={formData.insuranceValue}
                onChange={(e) => onChange({ insuranceValue: e.target.value })}
                placeholder="0.00"
                className="pl-9 bg-background"
                {...fieldErrorProps(
                  "insuranceValue",
                  fieldErrors.insuranceValue,
                )}
              />
            </div>
            <FieldError
              field="insuranceValue"
              message={fieldErrors.insuranceValue}
            />
          </div>
          <div className="space-y-2">
            <LoanCurrencyInput
              id="currency"
              value={formData.currency}
              onChange={(currency) => onChange({ currency })}
            />
            <FieldError field="currency" message={fieldErrors.currency} />
          </div>
        </div>
      </div>
    </div>
  );
}
