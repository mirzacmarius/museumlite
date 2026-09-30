"use client";

import { api } from "@v1/backend/convex/_generated/api";
import type { Id } from "@v1/backend/convex/_generated/dataModel";
import { Badge } from "@v1/ui/badge";
import { Button } from "@v1/ui/button";
import { DataTable } from "@v1/ui/data-table";
import { DatePickerInput } from "@v1/ui/date-picker";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@v1/ui/dialog";
import { EmptyState } from "@v1/ui/empty-state";
import { FeatureGuard } from "@v1/ui/feature-guard";
import { Input } from "@v1/ui/input";
import { Label } from "@v1/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@v1/ui/select";
import { useMutation, useQuery } from "convex/react";
import { Building2, Container, Plus, Search } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { toast } from "sonner";
import { ClientDate } from "@/components/client-date";
import { DashboardListPageSkeleton } from "@/components/dashboard-list-page-skeleton";
import { useOrganization } from "@/components/organization-provider";
import { PermissionGate } from "@/components/permission-gate";
import { useFeatureAccess } from "@/hooks/use-feature-access";
import { useCurrentLocale } from "@/locales/client";

type TransitStatus =
  | "all"
  | "draft"
  | "scheduled"
  | "in_transit"
  | "out_for_delivery"
  | "delivered"
  | "delayed"
  | "held"
  | "cancelled"
  | "returned";

type TransitType = "all" | "incoming" | "outgoing" | "internal" | "return";

const statusOptions: Array<{ label: string; value: TransitStatus }> = [
  { label: "All statuses", value: "all" },
  { label: "Draft", value: "draft" },
  { label: "Scheduled", value: "scheduled" },
  { label: "In transit", value: "in_transit" },
  { label: "Out for delivery", value: "out_for_delivery" },
  { label: "Delivered", value: "delivered" },
  { label: "Delayed", value: "delayed" },
  { label: "Held", value: "held" },
  { label: "Returned", value: "returned" },
  { label: "Cancelled", value: "cancelled" },
];

const typeOptions: Array<{ label: string; value: TransitType }> = [
  { label: "All types", value: "all" },
  { label: "Incoming", value: "incoming" },
  { label: "Outgoing", value: "outgoing" },
  { label: "Internal", value: "internal" },
  { label: "Return", value: "return" },
];

const statusColor: Record<string, string> = {
  draft: "bg-zinc-500/10 text-zinc-400 border-zinc-500/20",
  scheduled: "bg-blue-500/10 text-blue-400 border-blue-500/20",
  in_transit: "bg-amber-500/10 text-amber-400 border-amber-500/20",
  out_for_delivery: "bg-cyan-500/10 text-cyan-400 border-cyan-500/20",
  delivered: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
  delayed: "bg-rose-500/10 text-rose-400 border-rose-500/20",
  held: "bg-purple-500/10 text-purple-400 border-purple-500/20",
  returned: "bg-primary/10 text-primary border-primary/20",
  cancelled: "bg-zinc-500/10 text-zinc-400 border-zinc-500/20",
};

export function TransitPageClient() {
  const locale = useCurrentLocale();
  const { currentOrganizationId, organizations, isLoading } = useOrganization();
  const { hasFeature } = useFeatureAccess();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<TransitStatus>("all");
  const [typeFilter, setTypeFilter] = useState<TransitType>("all");
  const [dialogOpen, setDialogOpen] = useState(false);

  const transitRecords = useQuery(
    api.transit.listTransitRecords,
    currentOrganizationId
      ? {
          organizationId: currentOrganizationId as Id<"organizations">,
          paginationOpts: { numItems: 50, cursor: null },
          status: statusFilter === "all" ? undefined : statusFilter,
          transitType: typeFilter === "all" ? undefined : typeFilter,
          search: search || undefined,
        }
      : "skip",
  );

  const createTransit = useMutation(api.transit.createTransitRecord);

  if (isLoading) {
    return (
      <DashboardListPageSkeleton
        actionsCount={1}
        filtersCount={2}
        layout="list"
      />
    );
  }

  if (!organizations || organizations.length === 0 || !currentOrganizationId) {
    return (
      <div className="flex size-full items-center justify-center bg-background px-6 py-8">
        <div className="flex flex-col items-center gap-4 rounded-lg border border-border/60 bg-card p-8">
          <Building2 className="size-12 text-muted-foreground" />
          <div className="text-center">
            <h3 className="text-lg font-semibold">No Organization Selected</h3>
            <p className="mt-2 text-sm text-muted-foreground">
              Please select or create an organization to view transit logs.
            </p>
          </div>
          <Button asChild>
            <Link href="/organizations/new">
              <Plus className="mr-2 size-4" />
              Create Organization
            </Link>
          </Button>
        </div>
      </div>
    );
  }

  return (
    <FeatureGuard
      featureName="Transit Log"
      isLocked={!hasFeature("loans")}
      tierNeeded="pro"
    >
      <div className="flex size-full flex-col overflow-y-auto bg-background">
        <div className="mx-auto w-full max-w-7xl space-y-6 p-4 sm:space-y-8 sm:p-6">
          <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
            <div className="flex flex-col gap-2">
              <h2 className="page-title">Transit Log</h2>
              <p className="page-description">
                Track object movements and shipments
              </p>
            </div>
            <div className="flex flex-shrink-0 items-center gap-2">
              <PermissionGate permission="loans.create">
                <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
                  <DialogTrigger asChild>
                    <Button>
                      <Plus className="mr-2 size-4" />
                      Log Transit
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="sm:max-w-[520px]">
                    <DialogHeader>
                      <DialogTitle>New Transit Record</DialogTitle>
                      <DialogDescription className="sr-only">
                        Log a new transit record for an object movement or
                        shipment.
                      </DialogDescription>
                    </DialogHeader>
                    <TransitForm
                      organizationId={
                        currentOrganizationId as Id<"organizations">
                      }
                      onSubmit={async (payload) => {
                        try {
                          await createTransit(payload);
                          toast.success("Transit record created");
                          setDialogOpen(false);
                        } catch (err) {
                          toast.error(
                            err instanceof Error
                              ? err.message
                              : "Failed to create transit record",
                          );
                        }
                      }}
                    />
                  </DialogContent>
                </Dialog>
              </PermissionGate>
            </div>
          </div>

          <div className="space-y-6">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Search transit records..."
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  className="rounded-lg border-border/60 bg-card pl-9 text-xs transition-all focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500"
                />
              </div>
              <div className="flex gap-2">
                <Select
                  value={statusFilter}
                  onValueChange={(value) =>
                    setStatusFilter(value as TransitStatus)
                  }
                >
                  <SelectTrigger className="w-[180px] border-border/60 bg-card text-xs">
                    <SelectValue placeholder="Status" />
                  </SelectTrigger>
                  <SelectContent>
                    {statusOptions.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select
                  value={typeFilter}
                  onValueChange={(value) => setTypeFilter(value as TransitType)}
                >
                  <SelectTrigger className="w-[180px] border-border/60 bg-card text-xs">
                    <SelectValue placeholder="Type" />
                  </SelectTrigger>
                  <SelectContent>
                    {typeOptions.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <DataTable
              loading={transitRecords === undefined}
              data={transitRecords?.page ?? []}
              columns={[
                {
                  key: "transitNumber",
                  label: "Transit #",
                  className: "min-w-0 flex-[1.25]",
                  render: (record) => (
                    <span className="truncate font-semibold text-foreground">
                      {record.transitNumber}
                    </span>
                  ),
                },
                {
                  key: "transitType",
                  label: "Type",
                  className: "w-24 flex-none",
                  render: (record) => (
                    <span className="capitalize">{record.transitType}</span>
                  ),
                },
                {
                  key: "destinationName",
                  label: "Origin → Destination",
                  className: "min-w-0 flex-[1.8]",
                  render: (record) => (
                    <div className="flex min-w-0 flex-col">
                      <span className="truncate text-muted-foreground">
                        {record.originName}
                      </span>
                      <span className="truncate font-medium">
                        {record.destinationName}
                      </span>
                    </div>
                  ),
                },
                {
                  key: "carrier",
                  label: "Carrier",
                  className: "min-w-0 flex-[1.5]",
                  render: (record) => (
                    <div className="flex min-w-0 flex-col">
                      <span className="truncate text-muted-foreground">
                        {record.carrier}
                      </span>
                      {record.trackingNumber && (
                        <span className="truncate font-mono text-[10px]">
                          {record.trackingNumber}
                        </span>
                      )}
                    </div>
                  ),
                },
                {
                  key: "scheduledPickupDate",
                  label: "Pickup",
                  className: "w-28 flex-none",
                  render: (record) =>
                    record.scheduledPickupDate ? (
                      <ClientDate
                        timestamp={record.scheduledPickupDate}
                        locale={locale}
                      />
                    ) : (
                      "—"
                    ),
                },
                {
                  key: "estimatedDeliveryDate",
                  label: "ETA",
                  className: "w-28 flex-none",
                  render: (record) =>
                    record.estimatedDeliveryDate ? (
                      <ClientDate
                        timestamp={record.estimatedDeliveryDate}
                        locale={locale}
                      />
                    ) : (
                      "—"
                    ),
                },
                {
                  key: "itemCount",
                  label: "Items",
                  className: "w-20 flex-none justify-end text-right",
                },
                {
                  key: "status",
                  label: "Status",
                  className: "w-32 flex-none",
                  render: (record) => (
                    <Badge
                      variant="outline"
                      className={
                        statusColor[record.status] ??
                        "border-border text-muted-foreground"
                      }
                    >
                      {record.status.replace("_", " ")}
                    </Badge>
                  ),
                },
              ]}
              emptyState={
                <EmptyState
                  title="No transit records yet"
                  description="Log a shipment or movement to start tracking transit activity."
                  icon={Container}
                />
              }
            />
          </div>
        </div>
      </div>
    </FeatureGuard>
  );
}

function TransitForm({
  organizationId,
  onSubmit,
}: {
  organizationId: Id<"organizations">;
  onSubmit: (payload: {
    organizationId: Id<"organizations">;
    transitType: "incoming" | "outgoing" | "internal" | "return";
    originName: string;
    destinationName: string;
    carrier: string;
    scheduledPickupDate?: number;
    estimatedDeliveryDate?: number;
    trackingNumber?: string;
  }) => Promise<void>;
}) {
  const [form, setForm] = useState({
    transitType: "incoming" as "incoming" | "outgoing" | "internal" | "return",
    originName: "",
    destinationName: "",
    carrier: "",
    scheduledPickupDate: "",
    estimatedDeliveryDate: "",
    trackingNumber: "",
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!form.originName || !form.destinationName || !form.carrier) {
      toast.error("Please fill all required fields.");
      return;
    }

    const scheduledPickupDate = form.scheduledPickupDate
      ? Date.parse(form.scheduledPickupDate)
      : undefined;
    const estimatedDeliveryDate = form.estimatedDeliveryDate
      ? Date.parse(form.estimatedDeliveryDate)
      : undefined;

    if (
      (form.scheduledPickupDate && Number.isNaN(scheduledPickupDate)) ||
      (form.estimatedDeliveryDate && Number.isNaN(estimatedDeliveryDate))
    ) {
      toast.error("Please provide valid dates.");
      return;
    }

    setIsSubmitting(true);
    try {
      await onSubmit({
        organizationId,
        transitType: form.transitType,
        originName: form.originName.trim(),
        destinationName: form.destinationName.trim(),
        carrier: form.carrier.trim(),
        scheduledPickupDate,
        estimatedDeliveryDate,
        trackingNumber: form.trackingNumber.trim() || undefined,
      });
      setForm({
        transitType: "incoming",
        originName: "",
        destinationName: "",
        carrier: "",
        scheduledPickupDate: "",
        estimatedDeliveryDate: "",
        trackingNumber: "",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form className="space-y-4" onSubmit={handleSubmit}>
      <div className="space-y-2">
        <Label>Transit Type *</Label>
        <Select
          value={form.transitType}
          onValueChange={(value) =>
            setForm((prev) => ({
              ...prev,
              transitType: value as typeof form.transitType,
            }))
          }
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="incoming">Incoming</SelectItem>
            <SelectItem value="outgoing">Outgoing</SelectItem>
            <SelectItem value="internal">Internal</SelectItem>
            <SelectItem value="return">Return</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="originName">Origin *</Label>
          <Input
            id="originName"
            value={form.originName}
            onChange={(event) =>
              setForm((prev) => ({ ...prev, originName: event.target.value }))
            }
            placeholder="Main Museum"
            required
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="destinationName">Destination *</Label>
          <Input
            id="destinationName"
            value={form.destinationName}
            onChange={(event) =>
              setForm((prev) => ({
                ...prev,
                destinationName: event.target.value,
              }))
            }
            placeholder="Storage Facility"
            required
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="carrier">Carrier *</Label>
        <Input
          id="carrier"
          value={form.carrier}
          onChange={(event) =>
            setForm((prev) => ({ ...prev, carrier: event.target.value }))
          }
          placeholder="FedEx, DHL, Internal Courier"
          required
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="scheduledPickupDate">Scheduled Pickup</Label>
          <DatePickerInput
            id="scheduledPickupDate"
            value={form.scheduledPickupDate}
            onChange={(value) =>
              setForm((prev) => ({
                ...prev,
                scheduledPickupDate: value,
              }))
            }
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="estimatedDeliveryDate">Estimated Delivery</Label>
          <DatePickerInput
            id="estimatedDeliveryDate"
            value={form.estimatedDeliveryDate}
            onChange={(value) =>
              setForm((prev) => ({
                ...prev,
                estimatedDeliveryDate: value,
              }))
            }
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="trackingNumber">Tracking Number</Label>
        <Input
          id="trackingNumber"
          value={form.trackingNumber}
          onChange={(event) =>
            setForm((prev) => ({ ...prev, trackingNumber: event.target.value }))
          }
          placeholder="1Z999AA10123456784"
        />
      </div>

      <div className="flex justify-end">
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? "Creating..." : "Create Transit Record"}
        </Button>
      </div>
    </form>
  );
}
