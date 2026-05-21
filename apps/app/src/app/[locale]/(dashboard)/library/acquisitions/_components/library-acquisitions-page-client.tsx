"use client";

import { api } from "@v1/backend/convex/_generated/api";
import type { Id } from "@v1/backend/convex/_generated/dataModel";
import { Button } from "@v1/ui/button";
import { useMutation, useQuery } from "convex/react";
import { Plus } from "lucide-react";
import {
  type Dispatch,
  type SetStateAction,
  useCallback,
  useReducer,
} from "react";
import { DashboardListPageSkeleton } from "@/components/dashboard-list-page-skeleton";
import { useOrganization } from "@/components/organization-provider";
import { useFeatureAccess } from "@/hooks/use-feature-access";
import { useScopedI18n } from "@/locales/client";
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

interface AcquisitionsPageState {
  statusFilter: string;
  priorityFilter: string;
  isNewRequestOpen: boolean;
  isProcessing: boolean;
  newRequest: NewAcquisitionRequestForm;
}

type AcquisitionsPageAction =
  | { type: "setStatusFilter"; value: string }
  | { type: "setPriorityFilter"; value: string }
  | { type: "setNewRequestOpen"; value: boolean }
  | { type: "setProcessing"; value: boolean }
  | { type: "setNewRequest"; value: NewAcquisitionRequestForm }
  | { type: "closeNewRequestDialog" };

const initialAcquisitionsPageState: AcquisitionsPageState = {
  statusFilter: "all",
  priorityFilter: "all",
  isNewRequestOpen: false,
  isProcessing: false,
  newRequest: EMPTY_NEW_REQUEST,
};

function acquisitionsPageReducer(
  state: AcquisitionsPageState,
  action: AcquisitionsPageAction,
): AcquisitionsPageState {
  switch (action.type) {
    case "setStatusFilter":
      return { ...state, statusFilter: action.value };
    case "setPriorityFilter":
      return { ...state, priorityFilter: action.value };
    case "setNewRequestOpen":
      return { ...state, isNewRequestOpen: action.value };
    case "setProcessing":
      return { ...state, isProcessing: action.value };
    case "setNewRequest":
      return { ...state, newRequest: action.value };
    case "closeNewRequestDialog":
      return {
        ...state,
        isNewRequestOpen: false,
        newRequest: EMPTY_NEW_REQUEST,
      };
  }
}

export function LibraryAcquisitionsPageClient() {
  const { currentOrganizationId, organizations, isLoading } = useOrganization();
  const { hasModule } = useFeatureAccess();
  const tAcq = useScopedI18n("library.acquisitions");
  const [state, dispatch] = useReducer(
    acquisitionsPageReducer,
    initialAcquisitionsPageState,
  );

  const onNewRequestChange: Dispatch<
    SetStateAction<NewAcquisitionRequestForm>
  > = useCallback(
    (value) => {
      dispatch({
        type: "setNewRequest",
        value: typeof value === "function" ? value(state.newRequest) : value,
      });
    },
    [state.newRequest],
  );

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
            state.statusFilter !== "all"
              ? (state.statusFilter as RequestStatus)
              : undefined,
          priority:
            state.priorityFilter !== "all"
              ? (state.priorityFilter as Priority)
              : undefined,
        }
      : "skip",
  );

  const createRequest = useMutation(api.library.acquisitions.create);
  const updateStatus = useMutation(api.library.acquisitions.updateStatus);
  const approveRequest = useMutation(api.library.acquisitions.approve);
  const rejectRequest = useMutation(api.library.acquisitions.reject);

  const handleCreateRequest = async () => {
    if (!currentOrganizationId || !state.newRequest.title.trim()) return;
    dispatch({ type: "setProcessing", value: true });
    try {
      await createRequest({
        organizationId: currentOrganizationId as Id<"organizations">,
        title: state.newRequest.title,
        authors: state.newRequest.authors
          ? state.newRequest.authors.split(",").map((a) => a.trim())
          : undefined,
        isbn: state.newRequest.isbn || undefined,
        publisher: state.newRequest.publisher || undefined,
        reason: state.newRequest.reason || undefined,
        priority: state.newRequest.priority,
        quantity: Number.parseInt(state.newRequest.quantity, 10) || 1,
        estimatedPrice: state.newRequest.estimatedPrice
          ? Number.parseFloat(state.newRequest.estimatedPrice)
          : undefined,
      });
      dispatch({ type: "closeNewRequestDialog" });
    } catch (error) {
      console.error("Failed to create request:", error);
    } finally {
      dispatch({ type: "setProcessing", value: false });
    }
  };

  const handleStatusChange = async (
    requestId: Id<"libraryAcquisitionRequests">,
    newStatus: "ordered" | "received" | "cataloged" | "cancelled",
  ) => {
    dispatch({ type: "setProcessing", value: true });
    try {
      await updateStatus({ requestId, status: newStatus });
    } catch (error) {
      console.error("Failed to update status:", error);
    } finally {
      dispatch({ type: "setProcessing", value: false });
    }
  };

  const handleApprove = async (requestId: Id<"libraryAcquisitionRequests">) => {
    dispatch({ type: "setProcessing", value: true });
    try {
      await approveRequest({ requestId });
    } catch (error) {
      console.error("Failed to approve request:", error);
    } finally {
      dispatch({ type: "setProcessing", value: false });
    }
  };

  const handleReject = async (requestId: Id<"libraryAcquisitionRequests">) => {
    dispatch({ type: "setProcessing", value: true });
    try {
      await rejectRequest({ requestId });
    } catch (error) {
      console.error("Failed to reject request:", error);
    } finally {
      dispatch({ type: "setProcessing", value: false });
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
            <Button
              onClick={() =>
                dispatch({ type: "setNewRequestOpen", value: true })
              }
            >
              <Plus className="mr-2 size-4" />
              {tAcq("newRequest")}
            </Button>
          </div>
          <div className="flex w-full px-6">
            <div className="w-full border-b border-border" />
          </div>

          <AcquisitionsFilters
            statusFilter={state.statusFilter}
            priorityFilter={state.priorityFilter}
            onStatusFilterChange={(value) =>
              dispatch({ type: "setStatusFilter", value })
            }
            onPriorityFilterChange={(value) =>
              dispatch({ type: "setPriorityFilter", value })
            }
          />

          <AcquisitionsRequestsList
            requests={requests}
            statusFilter={state.statusFilter}
            priorityFilter={state.priorityFilter}
            isProcessing={state.isProcessing}
            onNewRequest={() =>
              dispatch({ type: "setNewRequestOpen", value: true })
            }
            onApprove={handleApprove}
            onReject={handleReject}
            onStatusChange={handleStatusChange}
          />
        </div>

        <NewAcquisitionRequestDialog
          open={state.isNewRequestOpen}
          onOpenChange={(value) =>
            dispatch({ type: "setNewRequestOpen", value })
          }
          newRequest={state.newRequest}
          onNewRequestChange={onNewRequestChange}
          isProcessing={state.isProcessing}
          onSubmit={handleCreateRequest}
        />
      </div>
    </div>
  );
}
