"use client";

import { useOrganization } from "@/components/organization-provider";
import { PermissionGate } from "@/components/permission-gate";
import { useFeatureAccess } from "@/hooks/use-feature-access";
import { formatDate } from "@/lib/format-date";
import { useCurrentLocale } from "@/locales/client";
import { api } from "@v1/backend/convex/_generated/api";
import type { Id } from "@v1/backend/convex/_generated/dataModel";
import { Badge } from "@v1/ui/badge";
import { Button } from "@v1/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@v1/ui/dialog";
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@v1/ui/table";
import { useMutation, useQuery } from "convex/react";
import { Building2, Container, Plus, Search } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { toast } from "sonner";

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
  returned: "bg-indigo-500/10 text-indigo-400 border-indigo-500/20",
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
      <div className="flex h-full w-full items-center justify-center">
        <p className="text-muted-foreground">Loading...</p>
      </div>
    );
  }

  if (!organizations || organizations.length === 0 || !currentOrganizationId) {
    return (
      <div className="flex h-full w-full items-center justify-center bg-background px-6 py-8">
        <div className="flex flex-col items-center gap-4 rounded-lg border border-border/60 bg-card p-8">
          <Building2 className="h-12 w-12 text-muted-foreground" />
          <div className="text-center">
            <h3 className="text-lg font-semibold">No Organization Selected</h3>
            <p className="mt-2 text-sm text-muted-foreground">
              Please select or create an organization to view transit logs.
            </p>
          </div>
          <Button asChild>
            <Link href="/organizations/new">
              <Plus className="mr-2 h-4 w-4" />
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
      <div className="flex h-full w-full bg-background px-4 sm:px-6">
        <div className="z-10 mx-auto flex h-full w-full max-w-screen-xl gap-12">
          <div className="flex w-full flex-col rounded-lg border border-border/60 bg-card">
            <div className="flex w-full flex-col sm:flex-row sm:items-center justify-between gap-4 rounded-lg p-4 sm:p-6">
              <div className="flex flex-col gap-2">
                <h2 className="text-xl font-medium text-primary">Transit Log</h2>
                <p className="text-sm font-normal text-primary/60">
                  Track object movements and shipments
                </p>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                <PermissionGate permission="loans.create">
                  <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
                    <DialogTrigger asChild>
                      <Button>
                        <Plus className="mr-2 h-4 w-4" />
                        Log Transit
                      </Button>
                    </DialogTrigger>
                    <DialogContent className="sm:max-w-[520px]">
                      <DialogHeader>
                        <DialogTitle>New Transit Record</DialogTitle>
                      </DialogHeader>
                      <TransitForm
                        organizationId={currentOrganizationId as Id<"organizations">}
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

            <div className="flex w-full px-6">
              <div className="w-full border-b border-border/60" />
            </div>

            <div className="p-6 space-y-6">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    placeholder="Search transit records..."
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                    className="pl-9"
                  />
                </div>
                <div className="flex gap-2">
                  <Select
                    value={statusFilter}
                    onValueChange={(value) => setStatusFilter(value as TransitStatus)}
                  >
                    <SelectTrigger className="w-[180px]">
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
                    <SelectTrigger className="w-[180px]">
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

              {transitRecords === undefined ? (
                <div className="flex h-48 items-center justify-center">
                  <p className="text-muted-foreground">Loading records...</p>
                </div>
              ) : transitRecords.page.length === 0 ? (
                <EmptyState
                  title="No transit records yet"
                  description="Log a shipment or movement to start tracking transit activity."
                  icon={Container}
                />
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Transit #</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Origin → Destination</TableHead>
                      <TableHead>Carrier</TableHead>
                      <TableHead>Pickup</TableHead>
                      <TableHead>ETA</TableHead>
                      <TableHead>Items</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {transitRecords.page.map((record) => (
                      <TableRow key={record._id}>
                        <TableCell className="font-medium">{record.transitNumber}</TableCell>
                        <TableCell className="capitalize">{record.transitType}</TableCell>
                        <TableCell>
                          <div className="text-xs text-muted-foreground">{record.originName}</div>
                          <div>{record.destinationName}</div>
                        </TableCell>
                        <TableCell>
                          <div className="text-xs text-muted-foreground">
                            {record.carrier}
                          </div>
                          {record.trackingNumber && (
                            <div className="text-xs">{record.trackingNumber}</div>
                          )}
                        </TableCell>
                        <TableCell>
                          {record.scheduledPickupDate
                            ? formatDate(new Date(record.scheduledPickupDate), locale)
                            : "—"}
                        </TableCell>
                        <TableCell>
                          {record.estimatedDeliveryDate
                            ? formatDate(new Date(record.estimatedDeliveryDate), locale)
                            : "—"}
                        </TableCell>
                        <TableCell>{record.itemCount}</TableCell>
                        <TableCell>
                          <Badge
                            variant="outline"
                            className={statusColor[record.status] ?? "border-border text-muted-foreground"}
                          >
                            {record.status.replace("_", " ")}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </div>
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
            setForm({ ...form, transitType: value as typeof form.transitType })
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
            onChange={(event) => setForm({ ...form, originName: event.target.value })}
            placeholder="Main Museum"
            required
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="destinationName">Destination *</Label>
          <Input
            id="destinationName"
            value={form.destinationName}
            onChange={(event) => setForm({ ...form, destinationName: event.target.value })}
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
          onChange={(event) => setForm({ ...form, carrier: event.target.value })}
          placeholder="FedEx, DHL, Internal Courier"
          required
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="scheduledPickupDate">Scheduled Pickup</Label>
          <Input
            id="scheduledPickupDate"
            type="date"
            value={form.scheduledPickupDate}
            onChange={(event) =>
              setForm({ ...form, scheduledPickupDate: event.target.value })
            }
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="estimatedDeliveryDate">Estimated Delivery</Label>
          <Input
            id="estimatedDeliveryDate"
            type="date"
            value={form.estimatedDeliveryDate}
            onChange={(event) =>
              setForm({ ...form, estimatedDeliveryDate: event.target.value })
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
            setForm({ ...form, trackingNumber: event.target.value })
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
