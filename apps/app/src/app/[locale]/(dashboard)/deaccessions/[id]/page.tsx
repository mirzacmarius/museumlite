"use client";

import { Header } from "@/app/[locale]/(dashboard)/_components/header";
import { api } from "@v1/backend/convex/_generated/api";
import type { Id } from "@v1/backend/convex/_generated/dataModel";
import { Button } from "@v1/ui/button";
import { useOrganization } from "@/components/organization-provider";
import { PermissionGate } from "@/components/permission-gate";
import { useQuery } from "convex/react";
import {
  ArrowLeft,
  Edit,
  CheckCircle,
  XCircle,
  Clock,
  ExternalLink,
} from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ApprovalWorkflow } from "./_components/approval-workflow";

export default function DeaccessionDetailPage() {
  const params = useParams();
  const deaccessionId = params.id as string;
  const { currentOrganizationId } = useOrganization();

  const deaccession = useQuery(
    api.deaccessions.get,
    deaccessionId ? { deaccessionId: deaccessionId as Id<"deaccessions"> } : "skip",
  );

  if (!currentOrganizationId) {
    return (
      <div className="flex h-full w-full items-center justify-center">
        <p className="text-muted-foreground">
          Please select an organization to view deaccessions.
        </p>
      </div>
    );
  }

  if (deaccession === undefined) {
    return (
      <div className="flex h-full w-full items-center justify-center">
        <p className="text-muted-foreground">Loading...</p>
      </div>
    );
  }

  if (deaccession === null) {
    return (
      <div className="flex h-full w-full items-center justify-center">
        <p className="text-muted-foreground">Deaccession not found</p>
      </div>
    );
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "pending":
        return <Clock className="h-5 w-5 text-yellow-500" />;
      case "approved":
        return <CheckCircle className="h-5 w-5 text-green-500" />;
      case "rejected":
        return <XCircle className="h-5 w-5 text-red-500" />;
      default:
        return null;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "pending":
        return "bg-yellow-500/10 text-yellow-600 dark:text-yellow-400";
      case "approved":
        return "bg-green-500/10 text-green-600 dark:text-green-400";
      case "rejected":
        return "bg-red-500/10 text-red-600 dark:text-red-400";
      default:
        return "bg-muted text-muted-foreground";
    }
  };

  return (
    <>
      <Header
        title={`Deaccession ${deaccession.deaccessionNumber}`}
        description={`${deaccession.method.charAt(0).toUpperCase() + deaccession.method.slice(1)} • ${new Date(deaccession.dateDeaccessioned).toLocaleDateString()}`}
      />
      <div className="flex h-full w-full bg-secondary px-6 py-8 dark:bg-black">
        <div className="z-10 mx-auto flex h-full w-full max-w-screen-xl gap-12">
          <div className="flex w-full flex-col rounded-lg border border-border bg-card dark:bg-black">
            {/* Header */}
            <div className="flex w-full items-center justify-between rounded-lg border-b border-border p-6">
              <div className="flex items-center gap-4">
                <Button variant="ghost" size="sm" asChild>
                  <Link href="/deaccessions">
                    <ArrowLeft className="mr-2 h-4 w-4" />
                    Back to Deaccessions
                  </Link>
                </Button>
                <div className="flex items-center gap-3">
                  {getStatusIcon(deaccession.status)}
                  <span
                    className={`rounded-full px-3 py-1 text-sm font-medium ${getStatusColor(
                      deaccession.status,
                    )}`}
                  >
                    {deaccession.status.charAt(0).toUpperCase() +
                      deaccession.status.slice(1)}
                  </span>
                  {deaccession.workflowStep && (
                    <span className="text-sm text-muted-foreground">
                      Step {deaccession.workflowStep}
                    </span>
                  )}
                </div>
              </div>
              <div className="flex gap-2">
                {deaccession.status === "pending" && (
                  <PermissionGate permission="collections.update">
                    <Button variant="outline" size="sm" asChild>
                      <Link href={`/deaccessions/${deaccessionId}/edit`}>
                        <Edit className="mr-2 h-4 w-4" />
                        Edit
                      </Link>
                    </Button>
                  </PermissionGate>
                )}
                <Button variant="outline" size="sm" asChild>
                  <Link href={`/collections/${deaccession.collectionId}`}>
                    <ExternalLink className="mr-2 h-4 w-4" />
                    View Collection
                  </Link>
                </Button>
              </div>
            </div>

            {/* Content */}
            <div className="p-6">
              <div className="grid gap-6 md:grid-cols-2">
                {/* Deaccession Details */}
                <div className="space-y-4">
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">
                      Deaccession Number
                    </label>
                    <p className="mt-1 text-lg font-medium">
                      {deaccession.deaccessionNumber}
                    </p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">
                      Date Deaccessioned
                    </label>
                    <p className="mt-1">
                      {new Date(
                        deaccession.dateDeaccessioned,
                      ).toLocaleDateString()}
                    </p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">
                      Reason
                    </label>
                    <p className="mt-1">{deaccession.reason}</p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">
                      Method
                    </label>
                    <p className="mt-1 capitalize">{deaccession.method}</p>
                  </div>
                  {deaccession.disposition && (
                    <div>
                      <label className="text-sm font-medium text-muted-foreground">
                        Disposition
                      </label>
                      <p className="mt-1">{deaccession.disposition}</p>
                    </div>
                  )}
                </div>

                <div className="space-y-4">
                  {deaccession.notes && (
                    <div>
                      <label className="text-sm font-medium text-muted-foreground">
                        Notes
                      </label>
                      <p className="mt-1 whitespace-pre-wrap">
                        {deaccession.notes}
                      </p>
                    </div>
                  )}
                  {deaccession.approvedBy && (
                    <div>
                      <label className="text-sm font-medium text-muted-foreground">
                        Approved By
                      </label>
                      <p className="mt-1">
                        {deaccession.approvedAt
                          ? new Date(deaccession.approvedAt).toLocaleString()
                          : "—"}
                      </p>
                    </div>
                  )}
                </div>
              </div>

              {/* Approval Workflow */}
              {deaccession.status === "pending" && (
                <div className="mt-8 border-t border-border pt-6">
                  <ApprovalWorkflow deaccessionId={deaccessionId} />
                </div>
              )}

              {/* Workflow History */}
              {deaccession.workflowHistory &&
                deaccession.workflowHistory.length > 0 && (
                  <div className="mt-8 border-t border-border pt-6">
                    <h3 className="mb-4 text-lg font-medium">
                      Workflow History
                    </h3>
                    <div className="space-y-3">
                      {deaccession.workflowHistory.map((entry) => (
                        <div
                          key={`${entry.step}-${entry.approvedBy}-${entry.approvedAt}`}
                          className="rounded-lg border border-border bg-card p-4"
                        >
                          <div className="flex items-center justify-between">
                            <div>
                              <p className="font-medium">Step {entry.step}</p>
                              <p className="text-sm text-muted-foreground">
                                {new Date(entry.approvedAt).toLocaleString()}
                              </p>
                              {entry.comment && (
                                <p className="mt-1 text-sm">{entry.comment}</p>
                              )}
                            </div>
                            <CheckCircle className="h-5 w-5 text-green-500" />
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

