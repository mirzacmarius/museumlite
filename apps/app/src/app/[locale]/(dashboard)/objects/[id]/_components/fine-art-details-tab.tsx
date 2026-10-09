"use client";

import { api } from "@v1/backend/convex/_generated/api";
import type { Id } from "@v1/backend/convex/_generated/dataModel";
import { FeatureGuard } from "@v1/ui/feature-guard";
import { cn } from "@v1/ui/utils";
import { useQuery } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import { DollarSign, FileCheck, History, Shield, Truck } from "lucide-react";
import { ClientDateFns } from "@/components/client-date";
import { RecordedValue } from "@/components/recorded-value";
import { useFeatureAccess } from "@/hooks/use-feature-access";
import { formatCurrency } from "@/lib/format-number";
import { useCurrentLocale, useI18n, useScopedI18n } from "@/locales/client";
import { formatOwnershipDateRange } from "./format-ownership-date-range";

interface FineArtDetailsTabProps {
  collectionId: string;
  organizationId: Id<"organizations">;
}

type FineArtDetails = NonNullable<
  FunctionReturnType<typeof api.fineArtDetails.get>
>;

export function FineArtDetailsTab({ collectionId }: FineArtDetailsTabProps) {
  const locale = useCurrentLocale();
  const tRoot = useI18n();
  const t = useScopedI18n("modules.fineArt");
  const common = useScopedI18n("modules.common");
  const { hasModule } = useFeatureAccess();
  const hasModuleAccess = hasModule("fine_art");
  const details = useQuery(
    api.fineArtDetails.get,
    hasModuleAccess
      ? { collectionId: collectionId as Id<"collections"> }
      : "skip",
  );

  if (!hasModuleAccess) {
    return (
      <FeatureGuard
        featureName={t("moduleName")}
        reason={{ kind: "module_disabled" }}
        description={t("moduleDescription")}
        showAction={false}
      >
        <div />
      </FeatureGuard>
    );
  }

  if (details === undefined) {
    return (
      <div className="flex h-32 items-center justify-center">
        <p className="text-sm text-muted-foreground">
          {common("loading", { module: "fine art" })}
        </p>
      </div>
    );
  }

  if (details === null) {
    return (
      <div className="space-y-6">
        <div className="flex h-32 items-center justify-center rounded-xl border border-dashed border-border">
          <p className="text-sm text-muted-foreground">
            {common("noDetailsYet", { module: "fine art" })}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-xl border border-border/60 bg-secondary/20 p-4">
          <div className="mb-2 flex items-center gap-2">
            <DollarSign className="size-4 text-emerald-500" />
            <span className="text-[10px] font-medium uppercase tracking-widest text-muted-foreground">
              {t("appraisedValue")}
            </span>
          </div>
          <RecordedValue
            value={details.appraisedValue}
            className="text-2xl font-light text-foreground"
          />
        </div>

        <div className="rounded-xl border border-border/60 bg-secondary/20 p-4">
          <div className="mb-2 flex items-center gap-2">
            <DollarSign className="size-4 text-blue-500" />
            <span className="text-[10px] font-medium uppercase tracking-widest text-muted-foreground">
              {t("replacementValue")}
            </span>
          </div>
          <RecordedValue
            value={details.replacementValue}
            className="text-2xl font-light text-foreground"
          />
        </div>

        <div className="rounded-xl border border-border/60 bg-secondary/20 p-4">
          <div className="mb-2 flex items-center gap-2">
            <Shield className="size-4 text-purple-500" />
            <span className="text-[10px] font-medium uppercase tracking-widest text-muted-foreground">
              {t("insurancePolicy")}
            </span>
          </div>
          <span className="text-sm font-medium text-foreground">
            {details.insurancePolicyNumber || t("notInsured")}
          </span>
          {details.insuranceCarrier && (
            <p className="mt-1 text-xs text-muted-foreground">
              {details.insuranceCarrier}
            </p>
          )}
        </div>

        <div className="rounded-xl border border-border/60 bg-secondary/20 p-4">
          <div className="mb-2 flex items-center gap-2">
            <FileCheck className="size-4 text-amber-500" />
            <span className="text-[10px] font-medium uppercase tracking-widest text-muted-foreground">
              {t("displayStatus")}
            </span>
          </div>
          <span
            className={cn(
              "inline-flex rounded px-2 py-0.5 text-xs font-medium",
              details.displayStatus === "on_display"
                ? "bg-emerald-500/10 text-emerald-500"
                : details.displayStatus === "loaned_out"
                  ? "bg-blue-500/10 text-blue-500"
                  : details.displayStatus === "in_transit"
                    ? "bg-amber-500/10 text-amber-500"
                    : "bg-secondary text-muted-foreground",
            )}
          >
            {details.displayStatus === "on_display"
              ? tRoot("objects.filters.onDisplay")
              : details.displayStatus === "loaned_out"
                ? tRoot("objects.filters.loaned")
                : details.displayStatus === "in_transit"
                  ? tRoot("loans.kpis.inTransit")
                  : details.displayStatus === "in_storage"
                    ? tRoot("objectTypeDetails.options.inStorage")
                    : details.displayStatus === "conservation"
                      ? tRoot("untranslatedRecords.objects.tabs.conservation")
                      : common("unknown")}
          </span>
        </div>
      </div>

      {details.reappraisalDate && (
        <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-4">
          <div className="flex items-center gap-2">
            <FileCheck className="size-4 text-amber-500" />
            <span className="text-sm font-medium text-amber-500">
              {t("reappraisalDue")}:{" "}
              <ClientDateFns
                timestamp={details.reappraisalDate}
                format="MMMM d, yyyy"
                locale={locale}
              />
            </span>
          </div>
        </div>
      )}

      <FineArtProvenanceSection details={details} />

      <div>
        <h3 className="mb-4 flex items-center gap-2 text-xs font-medium text-foreground">
          <Truck className="size-4 text-cyan-500" />
          {t("shippingMovementLog")}
        </h3>

        {details.shippingLogs && details.shippingLogs.length > 0 ? (
          <div className="space-y-3">
            {details.shippingLogs.map((log, _index) => (
              <div
                key={`${log.fromLocation}-${log.toLocation}-${log.departedAt ?? log.arrivedAt ?? ""}`}
                className="rounded-lg border border-border/60 bg-secondary/20 p-4"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-muted-foreground">
                      {log.fromLocation}
                    </span>
                    <span className="text-muted-foreground">→</span>
                    <span className="text-sm font-medium text-foreground">
                      {log.toLocation}
                    </span>
                  </div>
                  {log.arrivedAt && (
                    <span className="font-mono text-xs text-muted-foreground">
                      <ClientDateFns
                        timestamp={log.arrivedAt}
                        format="MMM d, yyyy"
                        locale={locale}
                      />
                    </span>
                  )}
                </div>
                {log.carrier && (
                  <p className="mt-1 text-xs text-muted-foreground">
                    {t("carrier")}: {log.carrier}
                    {log.trackingNumber && ` (${log.trackingNumber})`}
                  </p>
                )}
                {log.notes && (
                  <p className="mt-2 text-xs text-muted-foreground">
                    {log.notes}
                  </p>
                )}
              </div>
            ))}
          </div>
        ) : (
          <div className="flex h-24 items-center justify-center rounded-xl border border-dashed border-border">
            <p className="text-sm text-muted-foreground">
              {t("noShippingRecords")}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

function FineArtProvenanceSection({ details }: { details: FineArtDetails }) {
  const locale = useCurrentLocale();
  const t = useScopedI18n("modules.fineArt");

  return (
    <div>
      <h3 className="mb-4 flex items-center gap-2 text-xs font-medium text-foreground">
        <History className="size-4 text-purple-500" />
        {t("provenanceChain")}
      </h3>

      {details.provenanceChain && details.provenanceChain.length > 0 ? (
        <div className="relative space-y-4 border-l border-border pl-8">
          {details.provenanceChain.map((entry, index) => (
            <div
              key={`${entry.owner}-${entry.eventType}-${entry.startYear ?? ""}-${entry.endYear ?? ""}`}
              className="relative"
            >
              <div
                className={cn(
                  "absolute -left-[39px] top-1.5 flex size-4 items-center justify-center rounded-full bg-background",
                  index === 0
                    ? "border-2 border-accent"
                    : "border-2 border-muted-foreground/50",
                )}
              >
                {index === 0 && (
                  <div className="size-1.5 rounded-full bg-accent" />
                )}
              </div>
              <div className="rounded-lg border border-border/60 bg-secondary/20 p-4">
                <div className="mb-2 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span
                      className={cn(
                        "rounded px-1.5 py-0.5 text-[10px] font-medium uppercase",
                        entry.eventType === "sale"
                          ? "bg-emerald-500/10 text-emerald-500"
                          : entry.eventType === "auction"
                            ? "bg-amber-500/10 text-amber-500"
                            : entry.eventType === "inheritance"
                              ? "bg-purple-500/10 text-purple-500"
                              : "bg-secondary text-muted-foreground",
                      )}
                    >
                      {entry.eventType}
                    </span>
                    <h4 className="text-sm font-semibold text-foreground">
                      {entry.owner}
                    </h4>
                  </div>
                  {formatOwnershipDateRange(entry, {
                    presentLabel: "Present",
                    separator: " – ",
                  }) ? (
                    <span className="font-mono text-xs text-muted-foreground">
                      {formatOwnershipDateRange(entry, {
                        presentLabel: "Present",
                        separator: " – ",
                      })}
                    </span>
                  ) : null}
                </div>
                {entry.location && (
                  <p className="text-xs text-muted-foreground">
                    {entry.location}
                  </p>
                )}
                {entry.salePrice && (
                  <p className="mt-1 text-xs text-muted-foreground">
                    {t("salePrice")}:{" "}
                    {formatCurrency(
                      entry.salePrice,
                      locale,
                      entry.currency || "USD",
                    )}
                    {entry.auctionHouse && ` ${t("at")} ${entry.auctionHouse}`}
                  </p>
                )}
                {entry.notes && (
                  <p className="mt-2 text-sm text-muted-foreground">
                    {entry.notes}
                  </p>
                )}
                {entry.verified && (
                  <div className="mt-2 flex items-center gap-1 text-[10px] text-emerald-500">
                    <FileCheck className="size-3" />
                    {t("verified")}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="flex h-24 items-center justify-center rounded-xl border border-dashed border-border">
          <p className="text-sm text-muted-foreground">
            {t("noProvenanceRecorded")}
          </p>
        </div>
      )}
    </div>
  );
}
