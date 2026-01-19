"use client";

import { useOrganization } from "@/components/organization-provider";
import { useFeatureAccess } from "@/hooks/use-feature-access";
import { formatDate as formatDateUtil } from "@/lib/format-date";
import { formatCurrency } from "@/lib/format-number";
import { useCurrentLocale, useScopedI18n } from "@/locales/client";
import { api } from "@v1/backend/convex/_generated/api";
import type { Id } from "@v1/backend/convex/_generated/dataModel";
import { Badge } from "@v1/ui/badge";
import { Button } from "@v1/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@v1/ui/dialog";
import { Input } from "@v1/ui/input";
import { Label } from "@v1/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@v1/ui/select";
import { Textarea } from "@v1/ui/textarea";
import { useMutation, useQuery } from "convex/react";
import {
  AlertTriangle,
  Building2,
  Check,
  CheckCircle,
  Clock,
  DollarSign,
  Filter,
  Library,
  Loader2,
  Package,
  Plus,
  ShoppingCart,
  Truck,
  X,
} from "lucide-react";
import Link from "next/link";
import { useState } from "react";

const STATUS_FILTERS = [
  { value: "all", label: "All Status" },
  { value: "submitted", label: "Submitted" },
  { value: "under_review", label: "Under Review" },
  { value: "approved", label: "Approved" },
  { value: "ordered", label: "Ordered" },
  { value: "received", label: "Received" },
  { value: "cataloged", label: "Cataloged" },
  { value: "rejected", label: "Rejected" },
] as const;

const PRIORITY_FILTERS = [
  { value: "all", label: "All Priorities" },
  { value: "urgent", label: "Urgent" },
  { value: "high", label: "High" },
  { value: "normal", label: "Normal" },
  { value: "low", label: "Low" },
] as const;

type RequestStatus =
  | "submitted"
  | "under_review"
  | "approved"
  | "ordered"
  | "received"
  | "cataloged"
  | "rejected"
  | "cancelled";

type Priority = "low" | "normal" | "high" | "urgent";

export default function LibraryAcquisitionsPage() {
  const { currentOrganizationId, organizations, isLoading } = useOrganization();
  const { hasModule } = useFeatureAccess();
  const locale = useCurrentLocale();
  const t = useScopedI18n("library.placeholders");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [priorityFilter, setPriorityFilter] = useState<string>("all");
  const [isNewRequestOpen, setIsNewRequestOpen] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);

  // New request form state
  const [newRequest, setNewRequest] = useState({
    title: "",
    authors: "",
    isbn: "",
    publisher: "",
    reason: "",
    priority: "normal" as Priority,
    quantity: "1",
    estimatedPrice: "",
  });

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
      setNewRequest({
        title: "",
        authors: "",
        isbn: "",
        publisher: "",
        reason: "",
        priority: "normal",
        quantity: "1",
        estimatedPrice: "",
      });
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

  const handleReject = async (
    requestId: Id<"libraryAcquisitionRequests">,
    comment?: string,
  ) => {
    setIsProcessing(true);
    try {
      await rejectRequest({ requestId, comment });
    } catch (error) {
      console.error("Failed to reject request:", error);
    } finally {
      setIsProcessing(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex h-full w-full items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!organizations || organizations.length === 0) {
    return (
      <div className="flex h-full w-full items-center justify-center bg-background px-6 py-8">
        <div className="flex flex-col items-center gap-4 rounded-lg border border-border bg-card p-8">
          <Building2 className="h-12 w-12 text-muted-foreground" />
          <div className="text-center">
            <h3 className="text-lg font-semibold">No Organization Found</h3>
            <p className="mt-2 text-sm text-muted-foreground">
              You need to create an organization to manage acquisitions.
            </p>
          </div>
          <Button asChild>
            <Link href="/organizations/new">Create Organization</Link>
          </Button>
        </div>
      </div>
    );
  }

  if (!currentOrganizationId) {
    return (
      <div className="flex h-full w-full items-center justify-center bg-background px-6 py-8">
        <div className="flex flex-col items-center gap-4 rounded-lg border border-border bg-card p-8">
          <Library className="h-12 w-12 text-muted-foreground" />
          <div className="text-center">
            <h3 className="text-lg font-semibold">Select an Organization</h3>
            <p className="mt-2 text-sm text-muted-foreground">
              Please select an organization from the dropdown above.
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (isLibraryEnabled === false) {
    return (
      <div className="flex h-full w-full items-center justify-center bg-background px-6 py-8">
        <div className="flex flex-col items-center gap-4 rounded-lg border border-border bg-card p-8">
          <Library className="h-12 w-12 text-muted-foreground" />
          <div className="text-center">
            <h3 className="text-lg font-semibold">Library Not Enabled</h3>
            <p className="mt-2 text-sm text-muted-foreground">
              The Library integration is not enabled for this organization.
            </p>
          </div>
          <Button asChild>
            <Link href="/settings/integrations">Enable Integration</Link>
          </Button>
        </div>
      </div>
    );
  }

  const formatDate = (timestamp: number) => {
    return formatDateUtil(new Date(timestamp), locale);
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "submitted":
        return <Badge variant="secondary">Submitted</Badge>;
      case "under_review":
        return (
          <Badge variant="default" className="bg-blue-500">
            Under Review
          </Badge>
        );
      case "approved":
        return (
          <Badge variant="default" className="bg-green-500">
            Approved
          </Badge>
        );
      case "ordered":
        return (
          <Badge variant="default" className="bg-purple-500">
            Ordered
          </Badge>
        );
      case "received":
        return (
          <Badge variant="default" className="bg-teal-500">
            Received
          </Badge>
        );
      case "cataloged":
        return (
          <Badge variant="default" className="bg-green-600">
            Cataloged
          </Badge>
        );
      case "rejected":
        return <Badge variant="destructive">Rejected</Badge>;
      case "cancelled":
        return <Badge variant="outline">Cancelled</Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  const getPriorityBadge = (priority: string) => {
    switch (priority) {
      case "urgent":
        return <Badge variant="destructive">Urgent</Badge>;
      case "high":
        return (
          <Badge variant="default" className="bg-orange-500">
            High
          </Badge>
        );
      case "normal":
        return <Badge variant="secondary">Normal</Badge>;
      case "low":
        return <Badge variant="outline">Low</Badge>;
      default:
        return <Badge variant="secondary">{priority}</Badge>;
    }
  };

  return (
    <div className="flex h-full w-full bg-background px-6">
      <div className="z-10 mx-auto flex h-full w-full max-w-screen-xl flex-col gap-6 py-6">
        {/* Statistics */}
        {statistics && (
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4 lg:grid-cols-6">
            <div className="rounded-lg border border-border bg-card p-4">
              <div className="flex items-center gap-2 text-muted-foreground">
                <Clock className="h-4 w-4" />
                <span className="text-sm">Pending</span>
              </div>
              <p className="mt-2 text-2xl font-medium">
                {statistics.submitted + statistics.underReview}
              </p>
            </div>
            <div className="rounded-lg border border-border bg-card p-4">
              <div className="flex items-center gap-2 text-green-500">
                <Check className="h-4 w-4" />
                <span className="text-sm">Approved</span>
              </div>
              <p className="mt-2 text-2xl font-medium">{statistics.approved}</p>
            </div>
            <div className="rounded-lg border border-border bg-card p-4">
              <div className="flex items-center gap-2 text-purple-500">
                <Truck className="h-4 w-4" />
                <span className="text-sm">Ordered</span>
              </div>
              <p className="mt-2 text-2xl font-medium">{statistics.ordered}</p>
            </div>
            <div className="rounded-lg border border-border bg-card p-4">
              <div className="flex items-center gap-2 text-teal-500">
                <Package className="h-4 w-4" />
                <span className="text-sm">Received</span>
              </div>
              <p className="mt-2 text-2xl font-medium">{statistics.received}</p>
            </div>
            <div className="rounded-lg border border-border bg-card p-4">
              <div className="flex items-center gap-2 text-muted-foreground">
                <DollarSign className="h-4 w-4" />
                <span className="text-sm">Spent</span>
              </div>
              <p className="mt-2 text-2xl font-medium">
                {formatCurrency(statistics.totalSpent, locale, "USD")}
              </p>
            </div>
            <div className="rounded-lg border border-border bg-card p-4">
              <div className="flex items-center gap-2 text-muted-foreground">
                <AlertTriangle className="h-4 w-4" />
                <span className="text-sm">Pending Budget</span>
              </div>
              <p className="mt-2 text-2xl font-medium">
                {formatCurrency(statistics.pendingBudget, locale, "USD")}
              </p>
            </div>
          </div>
        )}

        <div className="flex w-full flex-col rounded-lg border border-border bg-card">
          {/* Header */}
          <div className="flex w-full items-center justify-between rounded-lg p-6">
            <div className="flex flex-col gap-2">
              <h2 className="text-xl font-medium text-primary">
                Acquisition Requests
              </h2>
              <p className="text-sm font-normal text-primary/60">
                Manage purchase requests and orders
              </p>
            </div>
            <Button onClick={() => setIsNewRequestOpen(true)}>
              <Plus className="mr-2 h-4 w-4" />
              New Request
            </Button>
          </div>
          <div className="flex w-full px-6">
            <div className="w-full border-b border-border" />
          </div>

          {/* Filters */}
          <div className="border-b border-border px-6 py-4">
            <div className="flex gap-4">
              <div className="flex items-center gap-2">
                <Filter className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm text-muted-foreground">Filters:</span>
              </div>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-40">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {STATUS_FILTERS.map((status) => (
                    <SelectItem key={status.value} value={status.value}>
                      {status.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={priorityFilter} onValueChange={setPriorityFilter}>
                <SelectTrigger className="w-40">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PRIORITY_FILTERS.map((priority) => (
                    <SelectItem key={priority.value} value={priority.value}>
                      {priority.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Requests List */}
          {requests === undefined ? (
            <div className="flex h-64 items-center justify-center">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : requests.page.length === 0 ? (
            <div className="flex h-64 flex-col items-center justify-center gap-4 p-6">
              <ShoppingCart className="h-12 w-12 text-muted-foreground" />
              <div className="text-center">
                <p className="font-medium">
                  {statusFilter !== "all" || priorityFilter !== "all"
                    ? "No requests found"
                    : "No acquisition requests"}
                </p>
                <p className="mt-2 text-sm text-muted-foreground">
                  {statusFilter !== "all" || priorityFilter !== "all"
                    ? "Try adjusting your filters"
                    : "Submit a request to add new items to the library"}
                </p>
              </div>
              {statusFilter === "all" && priorityFilter === "all" && (
                <Button onClick={() => setIsNewRequestOpen(true)}>
                  <Plus className="mr-2 h-4 w-4" />
                  Create First Request
                </Button>
              )}
            </div>
          ) : (
            <div className="p-6">
              <div className="space-y-4">
                {requests.page.map((request) => (
                  <div
                    key={request._id}
                    className="flex items-center justify-between rounded-lg border border-border p-4"
                  >
                    <div className="flex items-center gap-4">
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="font-medium">{request.title}</p>
                          {getStatusBadge(request.status)}
                          {getPriorityBadge(request.priority)}
                        </div>
                        {request.authors && request.authors.length > 0 && (
                          <p className="text-sm text-muted-foreground">
                            by {request.authors.join(", ")}
                          </p>
                        )}
                        <p className="text-xs text-muted-foreground">
                          Requested by{" "}
                          {request.requestedByUser?.name || "Unknown"} on{" "}
                          {formatDate(request.requestedAt)}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="text-right">
                        <p className="text-sm">Qty: {request.quantity}</p>
                        {request.estimatedPrice && (
                          <p className="text-xs text-muted-foreground">
                            Est:{" "}
                            {formatCurrency(
                              request.estimatedPrice,
                              locale,
                              "USD",
                            )}
                          </p>
                        )}
                      </div>
                      {request.status === "submitted" && (
                        <>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleReject(request._id)}
                            disabled={isProcessing}
                          >
                            <X className="mr-1 h-3 w-3" />
                            Reject
                          </Button>
                          <Button
                            size="sm"
                            onClick={() => handleApprove(request._id)}
                            disabled={isProcessing}
                          >
                            <Check className="mr-1 h-3 w-3" />
                            Review
                          </Button>
                        </>
                      )}
                      {request.status === "under_review" && (
                        <>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleReject(request._id)}
                            disabled={isProcessing}
                          >
                            <X className="mr-1 h-3 w-3" />
                            Reject
                          </Button>
                          <Button
                            size="sm"
                            onClick={() => handleApprove(request._id)}
                            disabled={isProcessing}
                          >
                            <Check className="mr-1 h-3 w-3" />
                            Approve
                          </Button>
                        </>
                      )}
                      {request.status === "approved" && (
                        <Button
                          size="sm"
                          onClick={() =>
                            handleStatusChange(request._id, "ordered")
                          }
                          disabled={isProcessing}
                        >
                          <Truck className="mr-1 h-3 w-3" />
                          Mark Ordered
                        </Button>
                      )}
                      {request.status === "ordered" && (
                        <Button
                          size="sm"
                          onClick={() =>
                            handleStatusChange(request._id, "received")
                          }
                          disabled={isProcessing}
                        >
                          <Package className="mr-1 h-3 w-3" />
                          Mark Received
                        </Button>
                      )}
                      {request.status === "received" && (
                        <Button
                          size="sm"
                          onClick={() =>
                            handleStatusChange(request._id, "cataloged")
                          }
                          disabled={isProcessing}
                        >
                          <CheckCircle className="mr-1 h-3 w-3" />
                          Cataloged
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* New Request Dialog */}
        <Dialog open={isNewRequestOpen} onOpenChange={setIsNewRequestOpen}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>New Acquisition Request</DialogTitle>
              <DialogDescription>
                Request a new item to be added to the library collection
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Title *</Label>
                <Input
                  value={newRequest.title}
                  onChange={(e) =>
                    setNewRequest((prev) => ({
                      ...prev,
                      title: e.target.value,
                    }))
                  }
                  placeholder={t("bookTitle")}
                />
              </div>
              <div className="space-y-2">
                <Label>Authors</Label>
                <Input
                  value={newRequest.authors}
                  onChange={(e) =>
                    setNewRequest((prev) => ({
                      ...prev,
                      authors: e.target.value,
                    }))
                  }
                  placeholder={t("commaSeparatedAuthors")}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>ISBN</Label>
                  <Input
                    value={newRequest.isbn}
                    onChange={(e) =>
                      setNewRequest((prev) => ({
                        ...prev,
                        isbn: e.target.value,
                      }))
                    }
                    placeholder={t("isbn")}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Publisher</Label>
                  <Input
                    value={newRequest.publisher}
                    onChange={(e) =>
                      setNewRequest((prev) => ({
                        ...prev,
                        publisher: e.target.value,
                      }))
                    }
                    placeholder={t("publisher")}
                  />
                </div>
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label>Priority</Label>
                  <Select
                    value={newRequest.priority}
                    onValueChange={(value: Priority) =>
                      setNewRequest((prev) => ({ ...prev, priority: value }))
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="low">Low</SelectItem>
                      <SelectItem value="normal">Normal</SelectItem>
                      <SelectItem value="high">High</SelectItem>
                      <SelectItem value="urgent">Urgent</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Quantity</Label>
                  <Input
                    type="number"
                    min="1"
                    value={newRequest.quantity}
                    onChange={(e) =>
                      setNewRequest((prev) => ({
                        ...prev,
                        quantity: e.target.value,
                      }))
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label>Est. Price</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={newRequest.estimatedPrice}
                    onChange={(e) =>
                      setNewRequest((prev) => ({
                        ...prev,
                        estimatedPrice: e.target.value,
                      }))
                    }
                    placeholder="0.00"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Reason for Request</Label>
                <Textarea
                  value={newRequest.reason}
                  onChange={(e) =>
                    setNewRequest((prev) => ({
                      ...prev,
                      reason: e.target.value,
                    }))
                  }
                  placeholder={t("whyNeeded")}
                  rows={3}
                />
              </div>
            </div>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => setIsNewRequestOpen(false)}
              >
                Cancel
              </Button>
              <Button
                onClick={handleCreateRequest}
                disabled={isProcessing || !newRequest.title.trim()}
              >
                {isProcessing && (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                )}
                Submit Request
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
