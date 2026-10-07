"use client";

import { Label } from "@v1/ui/label";
import { Textarea } from "@v1/ui/textarea";
import { FileText } from "lucide-react";
import { useI18n, useScopedI18n } from "@/locales/client";
import type { EditLoanFormData } from "./types";

interface EditLoanDetailsSectionProps {
  formData: EditLoanFormData;
  onChange: (updates: Partial<EditLoanFormData>) => void;
}

export function EditLoanDetailsSection({
  formData,
  onChange,
}: EditLoanDetailsSectionProps) {
  const tRoot = useI18n();
  const t = useScopedI18n("loans.placeholders");

  return (
    <div className="rounded-xl border border-border bg-card p-6 shadow-sm">
      <h2 className="text-sm font-semibold uppercase tracking-widest text-muted-foreground mb-6 flex items-center gap-2">
        <FileText className="size-4" />
        {tRoot("loans.actions.details")}
      </h2>

      <div className="space-y-6">
        <div className="space-y-2">
          <Label htmlFor="terms">
            {tRoot("loans.actions.termsConditions")}
          </Label>
          <Textarea
            id="terms"
            value={formData.terms}
            onChange={(e) => onChange({ terms: e.target.value })}
            placeholder={t("termsEdit")}
            rows={4}
            className="bg-background resize-none"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="notes">{tRoot("loans.actions.internalNotes")}</Label>
          <Textarea
            id="notes"
            value={formData.notes}
            onChange={(e) => onChange({ notes: e.target.value })}
            placeholder={t("notesEdit")}
            rows={3}
            className="bg-background resize-none"
          />
        </div>
      </div>
    </div>
  );
}
