"use client";

import { useOrganization } from "@/components/organization-provider";
import { useScopedI18n } from "@/locales/client";
import { api } from "@v1/backend/convex/_generated/api";
import type { Id } from "@v1/backend/convex/_generated/dataModel";
import { Button } from "@v1/ui/button";
import { useQuery } from "convex/react";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { EditLoanForm, EditLoanLockedView } from "../_components/edit-loan";
import type { Loan } from "../_components/types";

export default function EditLoanPage() {
  const tActions = useScopedI18n("loans.actions");
  const tLoans = useScopedI18n("loans");
  const tCommon = useScopedI18n("common");
  const params = useParams();
  const { back } = useRouter();
  const loanId = params.id as string;
  const { currentOrganizationId } = useOrganization();

  const loan = useQuery(
    api.loans.get,
    loanId ? { loanId: loanId as Id<"loans"> } : "skip",
  ) as Loan | null | undefined;

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

  if (loan.status !== "pending") {
    return <EditLoanLockedView loanId={loanId} status={loan.status} />;
  }

  return (
    <div className="flex h-full min-h-0 w-full flex-col bg-background">
      <header className="sticky top-0 z-50 flex h-14 items-center justify-between border-b border-border/60 bg-background/80 px-6 backdrop-blur-xl">
        <div className="flex items-center gap-2 text-xs">
          <Button variant="ghost" size="icon" className="size-7" asChild>
            <Link href={`/loans/${loanId}`}>
              <ArrowLeft className="size-4 text-muted-foreground" />
            </Link>
          </Button>
          <span className="text-muted-foreground">Loans</span>
          <span className="text-muted-foreground/50">/</span>
          <span className="text-muted-foreground">{loan.loanNumber}</span>
          <span className="text-muted-foreground/50">/</span>
          <span className="font-medium text-foreground">Edit</span>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto">
        <div className="mx-auto max-w-3xl px-6 py-8 pb-20">
          <div className="mb-8">
            <h1 className="text-2xl font-semibold tracking-tight text-foreground">
              Edit Loan Record
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              Update details for loan{" "}
              <span className="font-mono text-xs bg-secondary px-1.5 py-0.5 rounded">
                {loan.loanNumber}
              </span>
            </p>
          </div>

          <EditLoanForm loanId={loanId} loan={loan} onCancel={() => back()} />
        </div>
      </div>
    </div>
  );
}
