"use client";

import { Input } from "@v1/ui/input";
import { Label } from "@v1/ui/label";
import { cn } from "@v1/ui/utils";
import { Building2, Link2, Lock } from "lucide-react";
import Link from "next/link";
import {
  FieldError,
  fieldErrorProps,
} from "@/components/record-form/record-form-notices";
import { useI18n, useScopedI18n } from "@/locales/client";
import type { Loan } from "../types";
import type { EditLoanFormData } from "./types";

interface EditLoanCoreInfoSectionProps {
  loan: Loan;
  formData: EditLoanFormData;
  onChange: (updates: Partial<EditLoanFormData>) => void;
  /** The linked party names the lender or borrower; it is not retyped here. */
  isPartyLinked: boolean;
  partiesHref: string;
  fieldErrors: Record<string, string>;
}

export function EditLoanCoreInfoSection({
  loan,
  formData,
  onChange,
  isPartyLinked,
  partiesHref,
  fieldErrors,
}: EditLoanCoreInfoSectionProps) {
  const tRoot = useI18n();
  const tActions = useScopedI18n("loans.actions");
  const t = useScopedI18n("loans.placeholders");
  const tParty = useScopedI18n("recordForm.loan");

  return (
    <div className="rounded-xl border border-border bg-card p-6 shadow-sm">
      <h2 className="text-sm font-semibold uppercase tracking-widest text-muted-foreground mb-6 flex items-center gap-2">
        <Building2 className="size-4" />
        {tRoot("loans.actions.coreInformation")}
      </h2>

      <div className="grid gap-6">
        <div className="grid grid-cols-2 gap-4 rounded-lg bg-secondary/50 p-4 border border-border/50">
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">
              {tRoot("loans.actions.loanNumber")}
            </Label>
            <div className="font-mono text-sm font-medium">
              {loan.loanNumber}
            </div>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">
              {tRoot("loans.actions.loanType")}
            </Label>
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

        <p className="flex items-start gap-2 rounded-lg border border-border/60 bg-secondary/30 p-3 text-sm text-muted-foreground">
          <Link2 className="mt-0.5 size-4 shrink-0" />
          <span>
            {isPartyLinked ? tParty("partyLinked") : tParty("partyNotLinked")}{" "}
            <Link
              href={partiesHref}
              className="font-medium text-foreground underline underline-offset-4"
            >
              {isPartyLinked ? tParty("changeParty") : tParty("linkParty")}
            </Link>
          </span>
        </p>

        <div className="grid gap-6 md:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="lenderBorrowerName">
              {loan.type === "incoming"
                ? tActions("lender")
                : tActions("borrower")}{" "}
              {tRoot("collections.form.nameLabel")}{" "}
              <span className="text-destructive">*</span>
            </Label>
            <Input
              id="lenderBorrowerName"
              value={formData.lenderBorrowerName}
              onChange={(e) => onChange({ lenderBorrowerName: e.target.value })}
              placeholder={tRoot("loans.placeholders.institutionName")}
              readOnly={isPartyLinked}
              required
              className="bg-background read-only:cursor-default read-only:bg-muted/60 read-only:text-muted-foreground"
              {...fieldErrorProps(
                "lenderBorrowerName",
                fieldErrors.lenderBorrowerName,
              )}
            />
            <FieldError
              field="lenderBorrowerName"
              message={fieldErrors.lenderBorrowerName}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="lenderBorrowerContact">
              {tRoot("loans.actions.contactInformation")}
            </Label>
            <Input
              id="lenderBorrowerContact"
              value={formData.lenderBorrowerContact}
              onChange={(e) =>
                onChange({ lenderBorrowerContact: e.target.value })
              }
              placeholder={t("contactDetails")}
              readOnly={isPartyLinked}
              className="bg-background read-only:cursor-default read-only:bg-muted/60 read-only:text-muted-foreground"
              {...fieldErrorProps(
                "lenderBorrowerContact",
                fieldErrors.lenderBorrowerContact,
              )}
            />
            <FieldError
              field="lenderBorrowerContact"
              message={fieldErrors.lenderBorrowerContact}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
