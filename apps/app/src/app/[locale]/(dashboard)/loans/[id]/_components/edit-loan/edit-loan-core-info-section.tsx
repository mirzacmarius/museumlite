"use client";

import { Input } from "@v1/ui/input";
import { Label } from "@v1/ui/label";
import { cn } from "@v1/ui/utils";
import { Building2, Lock } from "lucide-react";
import { useScopedI18n } from "@/locales/client";
import type { Loan } from "../types";
import type { EditLoanFormData } from "./types";

interface EditLoanCoreInfoSectionProps {
  loan: Loan;
  formData: EditLoanFormData;
  onChange: (updates: Partial<EditLoanFormData>) => void;
}

export function EditLoanCoreInfoSection({
  loan,
  formData,
  onChange,
}: EditLoanCoreInfoSectionProps) {
  const tActions = useScopedI18n("loans.actions");
  const t = useScopedI18n("loans.placeholders");

  return (
    <div className="rounded-xl border border-border bg-card p-6 shadow-sm">
      <h2 className="text-sm font-semibold uppercase tracking-widest text-muted-foreground mb-6 flex items-center gap-2">
        <Building2 className="size-4" />
        Core Information
      </h2>

      <div className="grid gap-6">
        <div className="grid grid-cols-2 gap-4 rounded-lg bg-secondary/50 p-4 border border-border/50">
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Loan Number</Label>
            <div className="font-mono text-sm font-medium">
              {loan.loanNumber}
            </div>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Type</Label>
            <div className="flex items-center gap-2">
              <span
                className={cn(
                  "inline-flex items-center rounded-md px-2 py-1 text-xs font-medium ring-1 ring-inset",
                  loan.type === "incoming"
                    ? "bg-purple-50 text-purple-700 ring-purple-600/20 dark:bg-purple-900/20 dark:text-purple-400"
                    : "bg-cyan-50 text-cyan-700 ring-cyan-600/20 dark:bg-cyan-900/20 dark:text-cyan-400",
                )}
              >
                {loan.type === "incoming"
                  ? tActions("incomingLoan")
                  : tActions("outgoingLoan")}
              </span>
              <Lock className="size-3 text-muted-foreground/50" />
            </div>
          </div>
        </div>

        <div className="grid gap-6 md:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="lenderBorrowerName">
              {loan.type === "incoming"
                ? tActions("lender")
                : tActions("borrower")}{" "}
              Name <span className="text-destructive">*</span>
            </Label>
            <Input
              id="lenderBorrowerName"
              value={formData.lenderBorrowerName}
              onChange={(e) => onChange({ lenderBorrowerName: e.target.value })}
              placeholder="e.g. Museum of Modern Art"
              required
              className="bg-background"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="lenderBorrowerContact">Contact Information</Label>
            <Input
              id="lenderBorrowerContact"
              value={formData.lenderBorrowerContact}
              onChange={(e) =>
                onChange({ lenderBorrowerContact: e.target.value })
              }
              placeholder={t("contactDetails")}
              className="bg-background"
            />
          </div>
        </div>
      </div>
    </div>
  );
}
