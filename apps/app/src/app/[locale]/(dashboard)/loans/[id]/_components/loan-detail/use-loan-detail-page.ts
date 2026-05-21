"use client";

import { useOrganization } from "@/components/organization-provider";
import { writeTextToClipboard } from "@/lib/clipboard";
import { useCurrentLocale } from "@/locales/client";
import { api } from "@v1/backend/convex/_generated/api";
import type { Id } from "@v1/backend/convex/_generated/dataModel";
import { useQuery } from "convex/react";
import { useParams } from "next/navigation";
import { useState } from "react";
import type { Loan, LoanDocument } from "../types";

export function useLoanDetailPage() {
  const params = useParams();
  const loanId = params.id as string;
  const locale = useCurrentLocale();
  const { currentOrganizationId } = useOrganization();
  const [activeTab, setActiveTab] = useState("overview");
  const [isPrintModalOpen, setIsPrintModalOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  const loan = useQuery(
    api.loans.get,
    loanId ? { loanId: loanId as Id<"loans"> } : "skip",
  ) as Loan | null | undefined;

  const documents = useQuery(
    api.loans.listLoanDocuments,
    loanId ? { loanId: loanId as Id<"loans"> } : "skip",
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
