"use client";

import { useOrganization } from "@/components/organization-provider";
import { useFeatureAccess } from "@/hooks/use-feature-access";
import { formatDate as formatDateUtil } from "@/lib/format-date";
import { formatCurrency } from "@/lib/format-number";
import { useCurrentLocale, useScopedI18n } from "@/locales/client";
import { useI18n } from "@/locales/client";
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

// Status and priority filters will use i18n keys
const STATUS_FILTER_VALUES = [
  "all",
  "submitted",
  "under_review",
  "approved",
  "ordered",
  "received",
  "cataloged",
  "rejected",
] as const;

const PRIORITY_FILTER_VALUES = [
  "all",
  "urgent",
  "high",
  "normal",
  "low",
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
  const tLib = useScopedI18n("library");
  const tAcq = useScopedI18n("library.acquisitions");
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
            <h3 className="text-lg font-semibold">{tAcq("noOrganization")}</h3>
            <p className="mt-2 text-sm text-muted-foreground">
              {tAcq("noOrganizationDescription")}
            </p>
          </div>
          <Button asChild>
            <Link href="/organizations/new">{tLib("createOrganization")}</Link>
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
            <h3 className="text-lg font-semibold">
              {tAcq("selectOrganization")}
            </h3>
            <p className="mt-2 text-sm text-muted-foreground">
              {tAcq("selectOrganizationDescription")}
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
            <h3 className="text-lg font-semibold">{tAcq("notEnabled")}</h3>
            <p className="mt-2 text-sm text-muted-foreground">
              {tAcq("notEnabledDescription")}
            </p>
          </div>
          <Button asChild>
            <Link href="/settings/integrations">
              {tLib("enableIntegration")}
            </Link>
          </Button>
        </div>
      </div>
    );
  }

  const formatDate = (timestamp: number) => {
    return formatDateUtil(new Date(timestamp), locale);
  };

  const getStatusLabel = (status: string): string => {
    const statusMap: Record<string, string> = {
      submitted: tAcq("status.submitted"),
      under_review: tAcq("status.underReview"),
      approved: tAcq("status.approved"),
      ordered: tAcq("status.ordered"),
      received: tAcq("status.received"),
      cataloged: tAcq("status.cataloged"),
      rejected: tAcq("status.rejected"),
    };
    return statusMap[status] || status;
  };

  const getStatusBadge = (status: string) => {
    const label = getStatusLabel(status);
    switch (status) {
      case "submitted":
        return <Badge variant="secondary">{label}</Badge>;
      case "under_review":
        return (
          <Badge variant="default" className="bg-blue-500">
            {label}
          </Badge>
        );
      case "approved":
        return (
          <Badge variant="default" className="bg-green-500">
            {label}
          </Badge>
        );
      case "ordered":
        return (
          <Badge variant="default" className="bg-purple-500">
            {label}
          </Badge>
        );
      case "received":
        return (
          <Badge variant="default" className="bg-teal-500">
            {label}
          </Badge>
        );
      case "cataloged":
        return (
          <Badge variant="default" className="bg-green-600">
            {label}
          </Badge>
        );
      case "rejected":
        return <Badge variant="destructive">{label}</Badge>;
      case "cancelled":
        return <Badge variant="outline">{label}</Badge>;
      default:
        return <Badge variant="secondary">{label}</Badge>;
    }
  };

  const getPriorityLabel = (priority: string): string => {
    const priorityMap: Record<string, string> = {
      urgent: tAcq("priority.urgent"),
      high: tAcq("priority.high"),
      normal: tAcq("priority.normal"),
      low: tAcq("priority.low"),
    };
    return priorityMap[priority] || priority;
  };

  const getPriorityBadge = (priority: string) => {
    const label = getPriorityLabel(priority);
    switch (priority) {
      case "urgent":
        return <Badge variant="destructive">{label}</Badge>;
      case "high":
        return (
          <Badge variant="default" className="bg-orange-500">
            {label}
          </Badge>
        );
      case "normal":
        return <Badge variant="secondary">{label}</Badge>;
      case "low":
        return <Badge variant="outline">{label}</Badge>;
      default:
        return <Badge variant="secondary">{label}</Badge>;
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
                {tAcq("title")}
              </h2>
              <p className="text-sm font-normal text-primary/60">
                {tAcq("description")}
              </p>
            </div>
            <Button onClick={() => setIsNewRequestOpen(true)}>
              <Plus className="mr-2 h-4 w-4" />
              {tAcq("newRequest")}
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
                <span className="text-sm text-muted-foreground">
                  {tLib("filters")}:
                </span>
              </div>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-40">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {STATUS_FILTER_VALUES.map((value) => (
                    <SelectItem key={value} value={value}>
                      {value === "all"
                        ? tAcq("filters.allStatus")
                        : getStatusLabel(value)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={priorityFilter} onValueChange={setPriorityFilter}>
                <SelectTrigger className="w-40">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PRIORITY_FILTER_VALUES.map((value) => (
                    <SelectItem key={value} value={value}>
                      {value === "all"
                        ? tAcq("filters.allPriorities")
                        : getPriorityLabel(value)}
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
                    ? tAcq("noRequestsFiltered")
                    : tAcq("noRequests")}
                </p>
                <p className="mt-2 text-sm text-muted-foreground">
                  {statusFilter !== "all" || priorityFilter !== "all"
                    ? tAcq("tryAdjustFilters")
                    : tAcq("noRequestsDescription")}
                </p>
              </div>
              {statusFilter === "all" && priorityFilter === "all" && (
                <Button onClick={() => setIsNewRequestOpen(true)}>
                  <Plus className="mr-2 h-4 w-4" />
                  {tAcq("createFirst")}
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
                          {tAcq("labels.requestedBy")}{" "}
                          {request.requestedByUser?.name || "Unknown"}{" "}
                          {tAcq("labels.on")} {formatDate(request.requestedAt)}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="text-right">
                        <p className="text-sm">
                          {tAcq("labels.qty")} {request.quantity}
                        </p>
                        {request.estimatedPrice && (
                          <p className="text-xs text-muted-foreground">
                            {tAcq("labels.est")}{" "}
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
                            {tAcq("actions.reject")}
                          </Button>
                          <Button
                            size="sm"
                            onClick={() => handleApprove(request._id)}
                            disabled={isProcessing}
                          >
                            <Check className="mr-1 h-3 w-3" />
                            {tAcq("actions.review")}
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
                            {tAcq("actions.reject")}
                          </Button>
                          <Button
                            size="sm"
                            onClick={() => handleApprove(request._id)}
                            disabled={isProcessing}
                          >
                            <Check className="mr-1 h-3 w-3" />
                            {tAcq("actions.approve")}
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
                          {tAcq("actions.markOrdered")}
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
                          {tAcq("actions.markReceived")}
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
                          {tAcq("actions.cataloged")}
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
              <DialogTitle>{tAcq("form.title")}</DialogTitle>
              <DialogDescription>{tAcq("form.description")}</DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>{tAcq("form.titleLabel")}</Label>
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
                <Label>{tAcq("form.authors")}</Label>
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
                  <Label>{tAcq("form.isbn")}</Label>
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
                  <Label>{tAcq("form.publisher")}</Label>
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
                  <Label>{tAcq("form.priority")}</Label>
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
                      <SelectItem value="low">
                        {tAcq("priority.low")}
                      </SelectItem>
                      <SelectItem value="normal">
                        {tAcq("priority.normal")}
                      </SelectItem>
                      <SelectItem value="high">
                        {tAcq("priority.high")}
                      </SelectItem>
                      <SelectItem value="urgent">
                        {tAcq("priority.urgent")}
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>{tAcq("form.quantity")}</Label>
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
                  <Label>{tAcq("form.estPrice")}</Label>
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
                    placeholder={tAcq("form.estPricePlaceholder")}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label>{tAcq("form.reason")}</Label>
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
                {tAcq("form.cancel")}
              </Button>
              <Button
                onClick={handleCreateRequest}
                disabled={isProcessing || !newRequest.title.trim()}
              >
                {isProcessing && (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                )}
                {tAcq("submitRequest")}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
