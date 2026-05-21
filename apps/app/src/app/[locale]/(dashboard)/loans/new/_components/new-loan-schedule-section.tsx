"use client";

import { useScopedI18n } from "@/locales/client";
import { DatePicker } from "@v1/ui/date-picker";
import { Input } from "@v1/ui/input";
import { Label } from "@v1/ui/label";
import { Textarea } from "@v1/ui/textarea";
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
  const t = useScopedI18n("loans");

  return (
    <div className="rounded-xl border border-border bg-card p-6 shadow-sm">
      <h2 className="text-sm font-semibold uppercase tracking-widest text-muted-foreground mb-6 flex items-center gap-2">
        <span className="flex size-5 items-center justify-center rounded-full bg-muted text-[10px] text-foreground">
          2
        </span>
        Schedule & Terms
      </h2>

      <div className="grid gap-6">
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="startDate">
              Start Date <span className="text-destructive">*</span>
            </Label>
            <DatePicker
              id="startDate"
              date={formData.startDate}
              onSelect={(date: Date | undefined) =>
                onFormDataChange((prev) => ({
                  ...prev,
                  startDate: date ?? prev.startDate,
                }))
              }
              placeholder={t("placeholders.selectDate")}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="endDate">End Date</Label>
            <DatePicker
              id="endDate"
              date={formData.endDate}
              onSelect={(date: Date | undefined) =>
                onFormDataChange((prev) => ({ ...prev, endDate: date }))
              }
              placeholder={t("placeholders.selectDate")}
            />
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="insuranceValue">Total Insurance Value</Label>
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

        <div className="space-y-2">
          <Label htmlFor="terms">Terms & Conditions</Label>
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
          <Label htmlFor="notes">Internal Notes</Label>
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
