"use client";

import { api } from "@v1/backend/convex/_generated/api";
import type { Id } from "@v1/backend/convex/_generated/dataModel";
import { useQuery } from "convex/react";
import { useParams } from "next/navigation";
import { parseAsStringLiteral, useQueryState } from "nuqs";
import { useState } from "react";
import { useOrganization } from "@/components/organization-provider";
import { writeTextToClipboard } from "@/lib/clipboard";
import { useCurrentLocale } from "@/locales/client";
import type { Loan, LoanDocument } from "../types";

export const LOAN_TABS = ["overview", "objects", "activity"] as const;

export function useLoanDetailPage() {
  const params = useParams();
  const loanId = params.id as string;
  const locale = useCurrentLocale();
  const { currentOrganizationId } = useOrganization();
  // The open tab lives in the URL, so Back from an object opened in the
  // Objects tab returns to that tab.
  const [activeTab, setActiveTab] = useQueryState(
    "tab",
    parseAsStringLiteral(LOAN_TABS)
      .withDefault("overview")
      .withOptions({ history: "replace", scroll: false }),
  );
  const [isPrintModalOpen, setIsPrintModalOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  const loan = useQuery(
    api.loans.get,
    loanId ? { loanId: loanId as Id<"loans"> } : "skip",
  ) as Loan | null | undefined;

  const documents = useQuery(
    api.loans.listLoanDocuments,
    loan ? { loanId: loan._id } : "skip",
  ) as LoanDocument[] | undefined;

  const organization = useQuery(
    api.organizations.get,
    currentOrganizationId
      ? { organizationId: currentOrganizationId as Id<"organizations"> }
      : "skip",
  );

  const handleCopyId = async (loanNumber: string) => {
    const didCopy = await writeTextToClipboard(loanNumber);
    if (!didCopy) {
      return;
    }

    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return {
    loanId,
    locale,
    currentOrganizationId,
    loan,
    documents,
    organization,
    activeTab,
    setActiveTab,
    isPrintModalOpen,
    setIsPrintModalOpen,
    copied,
    handleCopyId,
  };
}
