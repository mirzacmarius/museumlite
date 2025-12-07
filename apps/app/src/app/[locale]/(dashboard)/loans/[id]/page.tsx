"use client";

import { useOrganization } from "@/components/organization-provider";
import { PermissionGate } from "@/components/permission-gate";
import { api } from "@v1/backend/convex/_generated/api";
import type { Id } from "@v1/backend/convex/_generated/dataModel";
import { Button } from "@v1/ui/button";
import { useQuery } from "convex/react";
import {
  ArrowDownRight,
  ArrowLeft,
  ArrowUpRight,
  CheckCircle,
  Clock,
  Edit,
  ExternalLink,
  Package,
  XCircle,
} from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { LoanAgreement } from "./_components/loan-agreement";
import { LoanApprovalWorkflow } from "./_components/loan-approval-workflow";
import { LoanItemsManager } from "./_components/loan-items-manager";

export default function LoanDetailPage() {
  const params = useParams();
  const loanId = params.id as string;
  const { currentOrganizationId } = useOrganization();

  const loan = useQuery(
    api.loans.get,
    loanId ? { loanId: loanId as Id<"loans"> } : "skip",
  );

  const organization = useQuery(
    api.organizations.get,
    currentOrganizationId
      ? { organizationId: currentOrganizationId as Id<"organizations"> }
      : "skip",
  );

  if (!currentOrganizationId) {
    return (
      <div className="flex h-full w-full items-center justify-center">
        <p className="text-muted-foreground">
          Please select an organization to view loans.
        </p>
      </div>
    );
  }

  if (loan === undefined) {
    return (
      <div className="flex h-full w-full items-center justify-center">
        <p className="text-muted-foreground">Loading...</p>
      </div>
    );
  }

  if (loan === null) {
    return (
      <div className="flex h-full w-full items-center justify-center">
        <p className="text-muted-foreground">Loan not found</p>
      </div>
    );
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "pending":
        return <Clock className="h-5 w-5 text-yellow-500" />;
      case "active":
        return <CheckCircle className="h-5 w-5 text-green-500" />;
      case "returned":
        return <CheckCircle className="h-5 w-5 text-blue-500" />;
      case "cancelled":
        return <XCircle className="h-5 w-5 text-red-500" />;
      default:
        return null;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "pending":
        return "bg-yellow-500/10 text-yellow-600 dark:text-yellow-400";
      case "active":
        return "bg-green-500/10 text-green-600 dark:text-green-400";
      case "returned":
        return "bg-blue-500/10 text-blue-600 dark:text-blue-400";
      case "cancelled":
        return "bg-red-500/10 text-red-600 dark:text-red-400";
      default:
        return "bg-muted text-muted-foreground";
    }
  };

  const getTypeIcon = (type: string) => {
    return type === "incoming" ? (
      <ArrowDownRight className="h-5 w-5 text-blue-500" />
    ) : (
      <ArrowUpRight className="h-5 w-5 text-purple-500" />
    );
  };

  return (
    <div className="flex h-full w-full bg-secondary px-6 dark:bg-black">
      <div className="z-10 mx-auto flex h-full w-full max-w-screen-xl gap-12">
        <div className="flex w-full flex-col rounded-lg border border-border bg-card dark:bg-black">
          {/* Header */}
          <div className="flex w-full items-center justify-between rounded-lg border-b border-border p-6">
            <div className="flex items-center gap-4">
              <Button variant="ghost" size="sm" asChild>
                <Link href="/loans">
                  <ArrowLeft className="mr-2 h-4 w-4" />
                  Back to Loans
                </Link>
              </Button>
              <div className="flex items-center gap-3">
                {getTypeIcon(loan.type)}
                <span className="rounded-full bg-muted px-3 py-1 text-sm font-medium">
                  {loan.type === "incoming" ? "Incoming" : "Outgoing"}
                </span>
                {getStatusIcon(loan.status)}
                <span
                  className={`rounded-full px-3 py-1 text-sm font-medium ${getStatusColor(
                    loan.status,
                  )}`}
                >
                  {loan.status.charAt(0).toUpperCase() + loan.status.slice(1)}
                </span>
              </div>
            </div>
            <div className="flex gap-2">
              <LoanAgreement
                loan={{
                  loanNumber: loan.loanNumber,
                  type: loan.type,
                  lenderBorrowerName: loan.lenderBorrowerName,
                  lenderBorrowerContact: loan.lenderBorrowerContact,
                  startDate: loan.startDate,
                  endDate: loan.endDate,
                  terms: loan.terms,
                  insuranceValue: loan.insuranceValue,
                  notes: loan.notes,
                  account: loan.account,
                }}
                items={loan.items.map((item) => ({
                  accessionNumber: item.accessionNumber,
                  title: item.title,
                  conditionOut: item.conditionOut,
                }))}
                organizationName={organization?.name || "Museum"}
              />
              {loan.status === "pending" && (
                <PermissionGate permission="loans.update">
                  <Button variant="outline" size="sm" asChild>
                    <Link href={`/loans/${loanId}/edit`}>
                      <Edit className="mr-2 h-4 w-4" />
                      Edit
                    </Link>
                  </Button>
                </PermissionGate>
              )}
            </div>
          </div>

          {/* Content */}
          <div className="p-6">
            <div className="grid gap-6 md:grid-cols-2">
              {/* Loan Details */}
              <div className="space-y-4">
                <div>
                  <label className="text-sm font-medium text-muted-foreground">
                    Loan Number
                  </label>
                  <p className="mt-1 text-lg font-medium">
                    {loan.loanNumber}
                  </p>
                </div>
                <div>
                  <label className="text-sm font-medium text-muted-foreground">
                    {loan.type === "incoming" ? "Lender" : "Borrower"}
                  </label>
                  <p className="mt-1">{loan.lenderBorrowerName}</p>
                </div>
                {loan.lenderBorrowerContact && (
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">
                      Contact
                    </label>
                    <p className="mt-1">{loan.lenderBorrowerContact}</p>
                  </div>
                )}
                <div>
                  <label className="text-sm font-medium text-muted-foreground">
                    Start Date
                  </label>
                  <p className="mt-1">
                    {new Date(loan.startDate).toLocaleDateString()}
                  </p>
                </div>
                {loan.endDate && (
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">
                      End Date
                    </label>
                    <p className="mt-1">
                      {new Date(loan.endDate).toLocaleDateString()}
                    </p>
                  </div>
                )}
                {loan.insuranceValue && (
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">
                      Insurance Value
                    </label>
                    <p className="mt-1">
                      ${loan.insuranceValue.toLocaleString()}
                    </p>
                  </div>
                )}
              </div>

              <div className="space-y-4">
                {loan.terms && (
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">
                      Terms
                    </label>
                    <p className="mt-1 whitespace-pre-wrap">{loan.terms}</p>
                  </div>
                )}
                {loan.notes && (
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">
                      Notes
                    </label>
                    <p className="mt-1 whitespace-pre-wrap">{loan.notes}</p>
                  </div>
                )}
                {loan.approvedBy && (
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">
                      Approved By
                    </label>
                    <p className="mt-1">
                      {loan.approvedAt
                        ? new Date(loan.approvedAt).toLocaleString()
                        : "—"}
                    </p>
                  </div>
                )}
              </div>
            </div>

            {/* Loan Items */}
            <div className="mt-8 border-t border-border pt-6">
              <LoanItemsManager
                loanId={loanId}
                loanItems={loan.items}
                organizationId={loan.organizationId}
                loanStatus={loan.status}
                loanType={loan.type}
              />
            </div>

            {/* Approval Workflow */}
            {(loan.status === "pending" || loan.status === "active") && (
              <div className="mt-8 border-t border-border pt-6">
                <LoanApprovalWorkflow
                  loanId={loanId}
                  loanStatus={loan.status}
                />
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
