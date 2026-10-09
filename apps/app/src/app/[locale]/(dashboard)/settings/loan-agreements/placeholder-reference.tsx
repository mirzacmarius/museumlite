"use client";

import {
  LOAN_AGREEMENT_PLACEHOLDERS,
  type LoanAgreementPlaceholder,
} from "@v1/backend/convex/utils/loanAgreementPlaceholders";
import { Copy } from "lucide-react";
import { toast } from "sonner";
import { writeTextToClipboard } from "@/lib/clipboard";
import { useScopedI18n } from "@/locales/client";

/** The placeholder vocabulary, each entry copyable into a section. */
export function PlaceholderReference() {
  const t = useScopedI18n("loanAgreementTemplates");
  const descriptions: Record<LoanAgreementPlaceholder, string> = {
    "loan.number": t("placeholders.loanNumber"),
    "loan.startDate": t("placeholders.loanStartDate"),
    "loan.endDate": t("placeholders.loanEndDate"),
    "loan.currency": t("placeholders.loanCurrency"),
    "loan.terms": t("placeholders.loanTerms"),
    "lender.name": t("placeholders.lenderName"),
    "borrower.name": t("placeholders.borrowerName"),
    "organization.name": t("placeholders.organizationName"),
    "object.list": t("placeholders.objectList"),
    "object.count": t("placeholders.objectCount"),
    "insurance.value": t("placeholders.insuranceValue"),
  };

  const copy = async (token: string) => {
    if (await writeTextToClipboard(token)) {
      toast.success(t("editor.copied", { placeholder: token }));
    }
  };

  return (
    <div className="space-y-2">
      <div>
        <p className="text-sm font-medium">{t("editor.placeholders")}</p>
        <p className="text-xs text-muted-foreground">
          {t("editor.placeholdersHint")}
        </p>
      </div>
      <ul className="grid gap-1 sm:grid-cols-2">
        {LOAN_AGREEMENT_PLACEHOLDERS.map((placeholder) => {
          const token = `{{${placeholder}}}`;
          return (
            <li key={placeholder}>
              <button
                type="button"
                onClick={() => copy(token)}
                className="flex w-full items-start gap-2 rounded-md border border-border px-2 py-1.5 text-left hover:bg-muted"
              >
                <Copy className="mt-0.5 size-3.5 shrink-0 text-muted-foreground" />
                <span className="min-w-0">
                  <code className="block truncate text-xs">{token}</code>
                  <span className="block text-xs text-muted-foreground">
                    {descriptions[placeholder]}
                  </span>
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
