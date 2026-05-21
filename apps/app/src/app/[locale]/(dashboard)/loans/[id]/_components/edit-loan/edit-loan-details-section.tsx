"use client";

import { useScopedI18n } from "@/locales/client";
import { Label } from "@v1/ui/label";
import { Textarea } from "@v1/ui/textarea";
import { FileText } from "lucide-react";
import type { EditLoanFormData } from "./types";

interface EditLoanDetailsSectionProps {
  formData: EditLoanFormData;
  onChange: (updates: Partial<EditLoanFormData>) => void;
}

export function EditLoanDetailsSection({
  formData,
  onChange,
}: EditLoanDetailsSectionProps) {
  const t = useScopedI18n("loans.placeholders");

  return (
    <div className="rounded-xl border border-border bg-card p-6 shadow-sm">
      <h2 className="text-sm font-semibold uppercase tracking-widest text-muted-foreground mb-6 flex items-center gap-2">
        <FileText className="size-4" />
        Details
      </h2>

      <div className="space-y-6">
        <div className="space-y-2">
          <Label htmlFor="terms">Terms & Conditions</Label>
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
          <Label htmlFor="notes">Internal Notes</Label>
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
