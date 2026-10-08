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
import { useCurrentLocale, useScopedI18n } from "@/locales/client";

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
  { label: "all", value: "all" },
  { label: "draft", value: "draft" },
  { label: "scheduled", value: "scheduled" },
  { label: "inTransit", value: "in_transit" },
  { label: "outForDelivery", value: "out_for_delivery" },
  { label: "delivered", value: "delivered" },
  { label: "delayed", value: "delayed" },
  { label: "held", value: "held" },
  { label: "returned", value: "returned" },
  { label: "cancelled", value: "cancelled" },
];

const typeOptions: Array<{ label: string; value: TransitType }> = [
  { label: "allTypes", value: "all" },
  { label: "incoming", value: "incoming" },
  { label: "outgoing", value: "outgoing" },
  { label: "internal", value: "internal" },
  { label: "return", value: "return" },
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
  const t = useScopedI18n("untranslatedDashboard.transit");
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
          <h3 className="text-lg font-semibold">{t("noOrganizationSelected")}</h3>
            <p className="mt-2 text-sm text-muted-foreground">
              {t("selectOrganizationDescription")}
            </p>
          </div>
          <Button asChild>
            <Link href="/organizations/new">
              <Plus className="mr-2 size-4" />
              {t("createOrganization")}
            </Link>
          </Button>
        </div>
      </div>
    );
  }

  return (
    <FeatureGuard
      featureName={t("title")}
      isLocked={!hasFeature("loans")}
      tierNeeded="pro"
    >
      <div className="flex size-full flex-col overflow-y-auto bg-background">
        <div className="mx-auto w-full max-w-7xl space-y-6 p-4 sm:space-y-8 sm:p-6">
          <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
            <div className="flex flex-col gap-2">
              <h2 className="page-title">{t("title")}</h2>
              <p className="page-description">
                {t("description")}
              </p>
            </div>
            <div className="flex flex-shrink-0 items-center gap-2">
              <PermissionGate permission="loans.create">
                <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
                  <DialogTrigger asChild>
                    <Button>
                      <Plus className="mr-2 size-4" />
                      {t("logTransit")}
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="sm:max-w-[520px]">
                    <DialogHeader>
                      <DialogTitle>{t("newRecord")}</DialogTitle>
                      <DialogDescription className="sr-only">
                        {t("newRecordDescription")}
                      </DialogDescription>
                    </DialogHeader>
                    <TransitForm
                      organizationId={
                        currentOrganizationId as Id<"organizations">
                      }
                      onSubmit={async (payload) => {
                        try {
                          await createTransit(payload);
                          toast.success(t("recordCreated"));
                          setDialogOpen(false);
                        } catch (err) {
                          toast.error(
                            err instanceof Error
                              ? err.message
                              : t("recordCreateFailed"),
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
                  placeholder={t("searchPlaceholder")}
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
                    <SelectValue placeholder={t("status")} />
                  </SelectTrigger>
                  <SelectContent>
                    {statusOptions.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {t(`statusOptions.${option.label}`)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select
                  value={typeFilter}
                  onValueChange={(value) => setTypeFilter(value as TransitType)}
                >
                  <SelectTrigger className="w-[180px] border-border/60 bg-card text-xs">
                    <SelectValue placeholder={t("type")} />
                  </SelectTrigger>
                  <SelectContent>
                    {typeOptions.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {t(`typeOptions.${option.label}`)}
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
                  label: t("transitNumber"),
                  className: "min-w-0 flex-[1.25]",
                  render: (record) => (
                    <Link
                      href={`/${locale}/transit/${record._id}`}
                      className="truncate font-semibold text-foreground hover:text-primary hover:underline"
                    >
                      {record.transitNumber}
                    </Link>
                  ),
                },
                {
                  key: "transitType",
                  label: t("type"),
                  className: "w-24 flex-none",
                  render: (record) => (
                    <span className="capitalize">
                      {t(`typeOptions.${record.transitType}`)}
                    </span>
                  ),
                },
                {
                  key: "destinationName",
                  label: t("originToDestination"),
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
                  label: t("carrier"),
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
                  label: t("pickup"),
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
                  label: t("estimatedArrival"),
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
                  label: t("items"),
                  className: "w-20 flex-none justify-end text-right",
                },
                {
                  key: "status",
                  label: t("status"),
                  className: "w-32 flex-none",
                  render: (record) => (
                    <Badge
                      variant="outline"
                      className={
                        statusColor[record.status] ??
                        "border-border text-muted-foreground"
                      }
                    >
                      {t(`statusOptions.${record.status}`)}
                    </Badge>
                  ),
                },
              ]}
              emptyState={
                <EmptyState
                  title={t("noRecordsYet")}
                  description={t("noRecordsDescription")}
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
  const t = useScopedI18n("untranslatedDashboard.transit");
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
      toast.error(t("requiredFieldsError"));
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
      toast.error(t("validDatesError"));
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
        <Label>{t("transitTypeRequired")}</Label>
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
            <SelectItem value="incoming">{t("typeOptions.incoming")}</SelectItem>
            <SelectItem value="outgoing">{t("typeOptions.outgoing")}</SelectItem>
            <SelectItem value="internal">{t("typeOptions.internal")}</SelectItem>
            <SelectItem value="return">{t("typeOptions.return")}</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="originName">{t("originRequired")}</Label>
          <Input
            id="originName"
            value={form.originName}
            onChange={(event) =>
              setForm((prev) => ({ ...prev, originName: event.target.value }))
            }
            placeholder={t("originPlaceholder")}
            required
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="destinationName">{t("destinationRequired")}</Label>
          <Input
            id="destinationName"
            value={form.destinationName}
            onChange={(event) =>
              setForm((prev) => ({
                ...prev,
                destinationName: event.target.value,
              }))
            }
            placeholder={t("destinationPlaceholder")}
            required
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="carrier">{t("carrierRequired")}</Label>
        <Input
          id="carrier"
          value={form.carrier}
          onChange={(event) =>
            setForm((prev) => ({ ...prev, carrier: event.target.value }))
          }
          placeholder={t("carrierPlaceholder")}
          required
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <DatePickerInput
          label={t("scheduledPickup")}
          id="scheduledPickupDate"
          value={form.scheduledPickupDate}
          onChange={(value) =>
            setForm((prev) => ({
              ...prev,
              scheduledPickupDate: value,
            }))
          }
        />
        <DatePickerInput
          label={t("estimatedDelivery")}
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

      <div className="space-y-2">
        <Label htmlFor="trackingNumber">{t("trackingNumber")}</Label>
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
          {isSubmitting ? t("creating") : t("createRecord")}
        </Button>
      </div>
    </form>
  );
}
