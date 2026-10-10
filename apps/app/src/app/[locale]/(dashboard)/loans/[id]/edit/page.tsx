"use client";

import { api } from "@v1/backend/convex/_generated/api";
import type { Id } from "@v1/backend/convex/_generated/dataModel";
import { useQuery } from "convex/react";
import { useParams } from "next/navigation";
import { useOrganization } from "@/components/organization-provider";
import { useScopedI18n } from "@/locales/client";
import { EditLoanForm } from "../_components/edit-loan/edit-loan-form";
import type { Loan } from "../_components/types";

export default function EditLoanPage() {
  const tActions = useScopedI18n("loans.actions");
  const tLoans = useScopedI18n("loans");
  const tCommon = useScopedI18n("common");
  const params = useParams();
  const loanId = params.id as Id<"loans">;
  const { currentOrganizationId } = useOrganization();

  const loan = useQuery(api.loans.get, loanId ? { loanId } : "skip") as
    | Loan
    | null
    | undefined;

  if (!currentOrganizationId) {
    return (
      <div className="flex size-full items-center justify-center">
        <p className="text-muted-foreground">
          {tActions("pleaseSelectOrgToEdit")}
        </p>
      </div>
    );
  }

  if (loan === undefined) {
    return (
      <div className="flex size-full items-center justify-center">
        <p className="text-muted-foreground">{tCommon("loading")}</p>
      </div>
    );
  }

  if (loan === null) {
    return (
      <div className="flex size-full bg-background">
        <p className="text-muted-foreground">
          {tLoans("emptyState.loanNotFound")}
        </p>
      </div>
    );
  }

  return <EditLoanForm key={loanId} loanId={loanId} loan={loan} />;
}
