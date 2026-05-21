"use client";

import { DashboardListPageSkeleton } from "@/components/dashboard-list-page-skeleton";
import { useOrganization } from "@/components/organization-provider";
import { useFeatureAccess } from "@/hooks/use-feature-access";
import { useScopedI18n } from "@/locales/client";
import { api } from "@v1/backend/convex/_generated/api";
import type { Id } from "@v1/backend/convex/_generated/dataModel";
import { Button } from "@v1/ui/button";
import { useMutation, useQuery } from "convex/react";
import { Plus } from "lucide-react";
import { useState } from "react";
import {
  AcquisitionsLibraryDisabledState,
  AcquisitionsNoOrganizationState,
  AcquisitionsSelectOrganizationState,
} from "./acquisitions-empty-states";
import { AcquisitionsFilters } from "./acquisitions-filters";
import { AcquisitionsRequestsList } from "./acquisitions-requests-list";
import { AcquisitionsStatistics } from "./acquisitions-statistics";
import { NewAcquisitionRequestDialog } from "./new-acquisition-request-dialog";
import {
  EMPTY_NEW_REQUEST,
  type NewAcquisitionRequestForm,
  type Priority,
  type RequestStatus,
} from "./types";

export function LibraryAcquisitionsPageClient() {
  const { currentOrganizationId, organizations, isLoading } = useOrganization();
  const { hasModule } = useFeatureAccess();
  const tAcq = useScopedI18n("library.acquisitions");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [priorityFilter, setPriorityFilter] = useState<string>("all");
  const [isNewRequestOpen, setIsNewRequestOpen] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [newRequest, setNewRequest] =
    useState<NewAcquisitionRequestForm>(EMPTY_NEW_REQUEST);

  const isLibraryEnabled = hasModule("library");

  const statistics = useQuery(
    api.library.acquisitions.getStatistics,
    currentOrganizationId && isLibraryEnabled
      ? { organizationId: currentOrganizationId as Id<"organizations"> }
      : "skip",
  );

  const requests = useQuery(
    api.library.acquisitions.list,
    currentOrganizationId && isLibraryEnabled
      ? {
          organizationId: currentOrganizationId as Id<"organizations">,
          paginationOpts: { numItems: 50, cursor: null },
          status:
            statusFilter !== "all"
              ? (statusFilter as RequestStatus)
              : undefined,
          priority:
            priorityFilter !== "all" ? (priorityFilter as Priority) : undefined,
        }
      : "skip",
  );

  const createRequest = useMutation(api.library.acquisitions.create);
  const updateStatus = useMutation(api.library.acquisitions.updateStatus);
  const approveRequest = useMutation(api.library.acquisitions.approve);
  const rejectRequest = useMutation(api.library.acquisitions.reject);

  const handleCreateRequest = async () => {
    if (!currentOrganizationId || !newRequest.title.trim()) return;
    setIsProcessing(true);
    try {
      await createRequest({
        organizationId: currentOrganizationId as Id<"organizations">,
        title: newRequest.title,
        authors: newRequest.authors
          ? newRequest.authors.split(",").map((a) => a.trim())
          : undefined,
        isbn: newRequest.isbn || undefined,
        publisher: newRequest.publisher || undefined,
        reason: newRequest.reason || undefined,
        priority: newRequest.priority,
        quantity: Number.parseInt(newRequest.quantity, 10) || 1,
        estimatedPrice: newRequest.estimatedPrice
          ? Number.parseFloat(newRequest.estimatedPrice)
          : undefined,
      });
      setIsNewRequestOpen(false);
      setNewRequest(EMPTY_NEW_REQUEST);
    } catch (error) {
      console.error("Failed to create request:", error);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleStatusChange = async (
    requestId: Id<"libraryAcquisitionRequests">,
    newStatus: "ordered" | "received" | "cataloged" | "cancelled",
  ) => {
    setIsProcessing(true);
    try {
      await updateStatus({ requestId, status: newStatus });
    } catch (error) {
      console.error("Failed to update status:", error);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleApprove = async (requestId: Id<"libraryAcquisitionRequests">) => {
    setIsProcessing(true);
    try {
      await approveRequest({ requestId });
    } catch (error) {
      console.error("Failed to approve request:", error);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleReject = async (requestId: Id<"libraryAcquisitionRequests">) => {
    setIsProcessing(true);
    try {
      await rejectRequest({ requestId });
    } catch (error) {
      console.error("Failed to reject request:", error);
    } finally {
      setIsProcessing(false);
    }
  };

  if (isLoading) {
    return (
      <DashboardListPageSkeleton actionsCount={1} filtersCount={2} showStats />
    );
  }

  if (!organizations || organizations.length === 0) {
    return <AcquisitionsNoOrganizationState />;
  }

  if (!currentOrganizationId) {
    return <AcquisitionsSelectOrganizationState />;
  }

  if (isLibraryEnabled === false) {
    return <AcquisitionsLibraryDisabledState />;
  }

  return (
    <div className="flex size-full bg-background px-6">
      <div className="z-10 mx-auto flex size-full max-w-screen-xl flex-col gap-6 py-6">
        {statistics && <AcquisitionsStatistics statistics={statistics} />}

        <div className="flex w-full flex-col rounded-lg border border-border bg-card">
          <div className="flex w-full items-center justify-between rounded-lg p-6">
            <div className="flex flex-col gap-2">
              <h2 className="text-xl font-medium text-primary">
                {tAcq("title")}
              </h2>
              <p className="text-sm font-normal text-primary/60">
                {tAcq("description")}
              </p>
            </div>
            <Button onClick={() => setIsNewRequestOpen(true)}>
              <Plus className="mr-2 size-4" />
              {tAcq("newRequest")}
            </Button>
          </div>
          <div className="flex w-full px-6">
            <div className="w-full border-b border-border" />
          </div>

          <AcquisitionsFilters
            statusFilter={statusFilter}
            priorityFilter={priorityFilter}
            onStatusFilterChange={setStatusFilter}
            onPriorityFilterChange={setPriorityFilter}
          />

          <AcquisitionsRequestsList
            requests={requests}
            statusFilter={statusFilter}
            priorityFilter={priorityFilter}
            isProcessing={isProcessing}
            onNewRequest={() => setIsNewRequestOpen(true)}
            onApprove={handleApprove}
            onReject={handleReject}
            onStatusChange={handleStatusChange}
          />
        </div>

        <NewAcquisitionRequestDialog
          open={isNewRequestOpen}
          onOpenChange={setIsNewRequestOpen}
          newRequest={newRequest}
          onNewRequestChange={setNewRequest}
          isProcessing={isProcessing}
          onSubmit={handleCreateRequest}
        />
      </div>
    </div>
  );
}
