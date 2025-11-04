"use client";

import { Header } from "@/app/[locale]/(dashboard)/_components/header";
import { useOrganization } from "@/components/organization-provider";
import { PermissionGate } from "@/components/permission-gate";
import { api } from "@v1/backend/convex/_generated/api";
import type { Id } from "@v1/backend/convex/_generated/dataModel";
import { Button } from "@v1/ui/button";
import { useMutation, useQuery } from "convex/react";
import {
  ArrowLeft,
  CheckCircle,
  Clock,
  Edit,
  ExternalLink,
  XCircle,
} from "lucide-react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useState } from "react";
import { ApprovalWorkflow } from "./_components/approval-workflow";

export default function AccessionDetailPage() {
  const params = useParams();
  const router = useRouter();
  const accessionId = params.id as string;
  const { currentOrganizationId } = useOrganization();

  const accession = useQuery(
    api.accessions.get,
    accessionId ? { accessionId: accessionId as Id<"accessions"> } : "skip",
  );

  if (!currentOrganizationId) {
    return (
      <div className="flex h-full w-full items-center justify-center">
        <p className="text-muted-foreground">
          Please select an organization to view accessions.
        </p>
      </div>
    );
  }

  if (accession === undefined) {
    return (
      <div className="flex h-full w-full items-center justify-center">
        <p className="text-muted-foreground">Loading...</p>
      </div>
    );
  }

  if (accession === null) {
    return (
      <div className="flex h-full w-full items-center justify-center">
        <p className="text-muted-foreground">Accession not found</p>
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
        title={`Accession ${accession.accessionNumber}`}
        description={`${accession.method.charAt(0).toUpperCase() + accession.method.slice(1)} • ${new Date(accession.dateReceived).toLocaleDateString()}`}
      />
      <div className="flex h-full w-full bg-secondary px-6 py-8 dark:bg-black">
        <div className="z-10 mx-auto flex h-full w-full max-w-screen-xl gap-12">
          <div className="flex w-full flex-col rounded-lg border border-border bg-card dark:bg-black">
            {/* Header */}
            <div className="flex w-full items-center justify-between rounded-lg border-b border-border p-6">
              <div className="flex items-center gap-4">
                <Button variant="ghost" size="sm" asChild>
                  <Link href="/accessions">
                    <ArrowLeft className="mr-2 h-4 w-4" />
                    Back to Accessions
                  </Link>
                </Button>
                <div className="flex items-center gap-3">
                  {getStatusIcon(accession.status)}
                  <span
                    className={`rounded-full px-3 py-1 text-sm font-medium ${getStatusColor(
                      accession.status,
                    )}`}
                  >
                    {accession.status.charAt(0).toUpperCase() +
                      accession.status.slice(1)}
                  </span>
                  {accession.workflowStep && (
                    <span className="text-sm text-muted-foreground">
                      Step {accession.workflowStep}
                    </span>
                  )}
                </div>
              </div>
              <div className="flex gap-2">
                {accession.status === "pending" && (
                  <PermissionGate permission="collections.update">
                    <Button variant="outline" size="sm" asChild>
                      <Link href={`/accessions/${accessionId}/edit`}>
                        <Edit className="mr-2 h-4 w-4" />
                        Edit
                      </Link>
                    </Button>
                  </PermissionGate>
                )}
                {accession.collectionId && (
                  <Button variant="outline" size="sm" asChild>
                    <Link href={`/collections/${accession.collectionId}`}>
                      <ExternalLink className="mr-2 h-4 w-4" />
                      View Collection
                    </Link>
                  </Button>
                )}
              </div>
            </div>

            {/* Content */}
            <div className="p-6">
              <div className="grid gap-6 md:grid-cols-2">
                {/* Accession Details */}
                <div className="space-y-4">
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">
                      Accession Number
                    </label>
                    <p className="mt-1 text-lg font-medium">
                      {accession.accessionNumber}
                    </p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">
                      Date Received
                    </label>
                    <p className="mt-1">
                      {new Date(accession.dateReceived).toLocaleDateString()}
                    </p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">
                      Source
                    </label>
                    <p className="mt-1">{accession.source}</p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">
                      Method
                    </label>
                    <p className="mt-1 capitalize">{accession.method}</p>
                  </div>
                  {accession.cost && (
                    <div>
                      <label className="text-sm font-medium text-muted-foreground">
                        Cost
                      </label>
                      <p className="mt-1">${accession.cost.toLocaleString()}</p>
                    </div>
                  )}
                </div>

                <div className="space-y-4">
                  {accession.notes && (
                    <div>
                      <label className="text-sm font-medium text-muted-foreground">
                        Notes
                      </label>
                      <p className="mt-1 whitespace-pre-wrap">
                        {accession.notes}
                      </p>
                    </div>
                  )}
                  {accession.approvedBy && (
                    <div>
                      <label className="text-sm font-medium text-muted-foreground">
                        Approved By
                      </label>
                      <p className="mt-1">
                        {accession.approvedAt
                          ? new Date(accession.approvedAt).toLocaleString()
                          : "—"}
                      </p>
                    </div>
                  )}
                </div>
              </div>

              {/* Approval Workflow */}
              {accession.status === "pending" && (
                <div className="mt-8 border-t border-border pt-6">
                  <ApprovalWorkflow accessionId={accessionId} />
                </div>
              )}

              {/* Workflow History */}
              {accession.workflowHistory &&
                accession.workflowHistory.length > 0 && (
                  <div className="mt-8 border-t border-border pt-6">
                    <h3 className="mb-4 text-lg font-medium">
                      Workflow History
                    </h3>
                    <div className="space-y-3">
                      {accession.workflowHistory.map((entry) => (
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
