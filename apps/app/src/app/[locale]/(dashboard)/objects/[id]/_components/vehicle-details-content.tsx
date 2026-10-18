"use client";

import { EmptyState } from "@v1/ui/empty-state";
import { cn } from "@v1/ui/utils";
import {
  Award,
  Car,
  DollarSign,
  Gauge,
  Settings,
  Trophy,
  Wrench,
} from "lucide-react";
import { ClientDateFns } from "@/components/client-date";
import { RecordedValue } from "@/components/recorded-value";
import { formatMoney, formatNumber } from "@/lib/format-number";
import { useCurrentLocale, useI18n, useScopedI18n } from "@/locales/client";
import { DetailField, DetailGrid, DetailSection } from "./detail-section";
import type { TypeDetailsRecord } from "./types";

type DetailsDoc = TypeDetailsRecord<"automotive">;

interface VehicleDetailsContentProps {
  details: DetailsDoc;
}

export function VehicleDetailsContent({ details }: VehicleDetailsContentProps) {
  const tRoot = useI18n();
  const locale = useCurrentLocale();
  const t = useScopedI18n("modules.vehicle");
  const _common = useScopedI18n("modules.common");
  return (
    <div className="space-y-8">
      <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-xl border border-border/60 bg-card p-4">
          <div className="mb-2 flex items-center gap-2">
            <Car className="size-4 text-muted-foreground" />
            <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              {t("vehicle")}
            </span>
          </div>
          <span className="text-lg font-medium text-foreground">
            {details.year} {details.make}
          </span>
          <p className="text-sm text-muted-foreground">{details.model}</p>
        </div>

        <div className="rounded-xl border border-border/60 bg-card p-4">
          <div className="mb-2 flex items-center gap-2">
            <Settings className="size-4 text-muted-foreground" />
            <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              {t("vin")}
            </span>
          </div>
          <span className="font-mono text-sm text-foreground">
            {details.vin || t("notRecorded")}
          </span>
        </div>

        <div className="rounded-xl border border-border/60 bg-card p-4">
          <div className="mb-2 flex items-center gap-2">
            <Gauge className="size-4 text-muted-foreground" />
            <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              {t("odometer")}
            </span>
          </div>
          <span className="text-2xl font-light text-foreground">
            {details.odometer ? formatNumber(details.odometer, locale) : "—"}
          </span>
          <span className="ml-1 text-sm text-muted-foreground">
            {details.odometerUnit || t("miles")}
          </span>
        </div>

        <div className="rounded-xl border border-border/60 bg-card p-4">
          <div className="mb-2 flex items-center gap-2">
            <DollarSign className="size-4 text-muted-foreground" />
            <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              {t("insuranceValue")}
            </span>
          </div>
          <RecordedValue
            value={details.insuranceValue}
            className="text-2xl font-light text-foreground"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        <DetailSection
          title={tRoot("untranslatedRecords.objects.detail.specifications")}
        >
          <DetailGrid>
            <DetailField
              label={tRoot("untranslatedRecords.objects.detail.bodyStyle")}
              value={details.bodyStyle}
            />
            <DetailField
              label={tRoot("untranslatedRecords.objects.detail.fuelType")}
              value={details.fuelType}
            />
            <DetailField
              label={tRoot("untranslatedRecords.objects.detail.transmission")}
              value={details.transmissionType}
            />
            <DetailField
              label={tRoot("untranslatedRecords.objects.detail.engineNumber")}
            >
              <div className="font-mono text-sm text-foreground">
                {details.engineNumber || "—"}
              </div>
            </DetailField>
            <DetailField
              label={tRoot("untranslatedRecords.objects.detail.exterior")}
              value={details.exteriorColor}
            />
            <DetailField
              label={tRoot("untranslatedRecords.objects.detail.interior")}
              value={details.interiorColor}
            />
          </DetailGrid>
        </DetailSection>

        <DetailSection
          title={tRoot("untranslatedRecords.objects.detail.registration")}
        >
          <DetailGrid>
            <DetailField
              label={tRoot("untranslatedRecords.objects.detail.plateNumber")}
            >
              <div className="font-mono text-sm text-foreground">
                {details.registrationNumber || "—"}
              </div>
            </DetailField>
            <DetailField
              label={tRoot("untranslatedRecords.objects.detail.state")}
              value={details.registrationState}
            />
            <DetailField
              label={tRoot("untranslatedRecords.objects.detail.titleNumber")}
            >
              <div className="font-mono text-sm text-foreground">
                {details.titleNumber || "—"}
              </div>
            </DetailField>
          </DetailGrid>
        </DetailSection>
      </div>

      <DetailSection
        title={t("serviceHistory")}
        icon={Wrench}
        bodyClassName="border-0 bg-transparent p-0 sm:p-0"
      >
        {details.serviceLog && details.serviceLog.length > 0 ? (
          <div className="space-y-3">
            {details.serviceLog.map((entry, _index) => (
              <div
                key={`${entry.serviceDate}-${entry.serviceType}-${entry.description}`}
                className="rounded-lg border border-border/60 bg-card p-4"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="rounded bg-blue-500/10 px-2 py-0.5 text-xs font-medium uppercase text-blue-700 dark:text-blue-400">
                      {entry.serviceType}
                    </span>
                    <span className="text-sm font-medium text-foreground">
                      {entry.description}
                    </span>
                  </div>
                  <span className="font-mono text-xs text-muted-foreground">
                    <ClientDateFns
                      timestamp={entry.serviceDate}
                      format="MMM d, yyyy"
                      locale={locale}
                    />
                  </span>
                </div>
                <div className="mt-2 flex items-center gap-4 text-xs text-muted-foreground">
                  {entry.mileage && (
                    <span>
                      {formatNumber(entry.mileage, locale)} {t("miles")}
                    </span>
                  )}
                  {entry.provider && <span>{entry.provider}</span>}
                  {entry.cost && (
                    // Maintenance costs are stored without a currency.
                    <span>{formatMoney(entry.cost, locale, undefined)}</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <EmptyState variant="card" size="sm" title={t("noServiceRecords")} />
        )}
      </DetailSection>

      <DetailSection
        title={t("eventHistory")}
        icon={Trophy}
        bodyClassName="border-0 bg-transparent p-0 sm:p-0"
      >
        {details.eventHistory && details.eventHistory.length > 0 ? (
          <div className="space-y-3">
            {details.eventHistory.map((event, _index) => (
              <div
                key={`${event.eventDate}-${event.eventType}-${event.eventName ?? ""}`}
                className="rounded-lg border border-border/60 bg-card p-4"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span
                      className={cn(
                        "rounded px-2 py-0.5 text-xs font-medium uppercase",
                        event.eventType === "concours"
                          ? "bg-amber-500/10 text-amber-700 dark:text-amber-400"
                          : event.eventType === "race"
                            ? "bg-rose-500/10 text-rose-700 dark:text-rose-400"
                            : "bg-secondary text-muted-foreground",
                      )}
                    >
                      {event.eventType}
                    </span>
                    <span className="text-sm font-medium text-foreground">
                      {event.eventName}
                    </span>
                  </div>
                  <span className="font-mono text-xs text-muted-foreground">
                    <ClientDateFns
                      timestamp={event.eventDate}
                      format="MMM d, yyyy"
                      locale={locale}
                    />
                  </span>
                </div>
                {event.location && (
                  <p className="mt-1 text-xs text-muted-foreground">
                    {event.location}
                  </p>
                )}
                {event.result && (
                  <p className="mt-1 text-sm text-foreground">{event.result}</p>
                )}
                {event.awards && event.awards.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1">
                    {event.awards.map((award) => (
                      <span
                        key={award}
                        className="flex items-center gap-1 rounded bg-amber-500/10 px-2 py-0.5 text-xs text-amber-700 dark:text-amber-400"
                      >
                        <Award className="size-3" />
                        {award}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        ) : (
          <EmptyState variant="card" size="sm" title={t("noEventHistory")} />
        )}
      </DetailSection>
    </div>
  );
}
