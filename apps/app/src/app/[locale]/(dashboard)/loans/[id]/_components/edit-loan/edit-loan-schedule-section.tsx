"use client";

import { useScopedI18n } from "@/locales/client";
import { DatePicker } from "@v1/ui/date-picker";
import { Input } from "@v1/ui/input";
import { Label } from "@v1/ui/label";
import { Banknote, Calendar } from "lucide-react";
import type { EditLoanFormData } from "./types";

interface EditLoanScheduleSectionProps {
  formData: EditLoanFormData;
  onChange: (updates: Partial<EditLoanFormData>) => void;
}

export function EditLoanScheduleSection({
  formData,
  onChange,
}: EditLoanScheduleSectionProps) {
  const t = useScopedI18n("loans.placeholders");

  return (
    <div className="rounded-xl border border-border bg-card p-6 shadow-sm">
      <h2 className="text-sm font-semibold uppercase tracking-widest text-muted-foreground mb-6 flex items-center gap-2">
        <Calendar className="size-4" />
        Schedule & Value
      </h2>

      <div className="grid gap-6 md:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="startDate">
            Start Date <span className="text-destructive">*</span>
          </Label>
          <DatePicker
            id="startDate"
            date={formData.startDate}
            onSelect={(date: Date | undefined) =>
              onChange({ startDate: date ?? formData.startDate })
            }
            placeholder={t("selectStartDate")}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="endDate">End Date</Label>
          <DatePicker
            id="endDate"
            date={formData.endDate}
            onSelect={(date: Date | undefined) => onChange({ endDate: date })}
            placeholder={t("selectEndDate")}
          />
        </div>

        <div className="space-y-2 md:col-span-2">
          <Label htmlFor="insuranceValue">Insurance Value</Label>
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
      </div>
    </div>
  );
}
