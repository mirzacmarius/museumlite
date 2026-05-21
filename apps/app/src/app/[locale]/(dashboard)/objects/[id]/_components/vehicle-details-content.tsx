"use client";

import { ClientDateFns } from "@/components/client-date";
import { formatCurrency, formatNumber } from "@/lib/format-number";
import { useCurrentLocale, useScopedI18n } from "@/locales/client";
import type { api } from "@v1/backend/convex/_generated/api";
import { cn } from "@v1/ui/utils";
import type { FunctionReturnType } from "convex/server";
import {
  Award,
  Car,
  DollarSign,
  Gauge,
  Settings,
  Trophy,
  Wrench,
} from "lucide-react";

type DetailsDoc = NonNullable<
  FunctionReturnType<typeof api.vehicleDetails.get>
>;

interface VehicleDetailsContentProps {
  details: DetailsDoc;
}

export function VehicleDetailsContent({ details }: VehicleDetailsContentProps) {
  const locale = useCurrentLocale();
  const t = useScopedI18n("modules.vehicle");
  const common = useScopedI18n("modules.common");
  return (
    <div className="space-y-8">
      <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-xl border border-border/60 bg-secondary/20 p-4">
          <div className="mb-2 flex items-center gap-2">
            <Car className="size-4 text-blue-500" />
            <span className="text-[10px] font-medium uppercase tracking-widest text-muted-foreground">
              {t("vehicle")}
            </span>
          </div>
          <span className="text-lg font-medium text-foreground">
            {details.year} {details.make}
          </span>
          <p className="text-sm text-muted-foreground">{details.model}</p>
        </div>

        <div className="rounded-xl border border-border/60 bg-secondary/20 p-4">
          <div className="mb-2 flex items-center gap-2">
            <Settings className="size-4 text-muted-foreground" />
            <span className="text-[10px] font-medium uppercase tracking-widest text-muted-foreground">
              {t("vin")}
            </span>
          </div>
          <span className="font-mono text-sm text-foreground">
            {details.vin || t("notRecorded")}
          </span>
        </div>

        <div className="rounded-xl border border-border/60 bg-secondary/20 p-4">
          <div className="mb-2 flex items-center gap-2">
            <Gauge className="size-4 text-amber-500" />
            <span className="text-[10px] font-medium uppercase tracking-widest text-muted-foreground">
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

        <div className="rounded-xl border border-border/60 bg-secondary/20 p-4">
          <div className="mb-2 flex items-center gap-2">
            <DollarSign className="size-4 text-emerald-500" />
            <span className="text-[10px] font-medium uppercase tracking-widest text-muted-foreground">
              {t("insuranceValue")}
            </span>
          </div>
          <span className="text-2xl font-light text-foreground">
            {details.insuranceValue
              ? formatCurrency(details.insuranceValue, locale, "USD")
              : "—"}
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        <div className="rounded-xl border border-border/60 bg-secondary/20 p-4">
          <h4 className="mb-4 text-xs font-medium uppercase tracking-widest text-muted-foreground">
            Specifications
          </h4>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <span className="text-[10px] text-muted-foreground">
                Body Style
              </span>
              <p className="text-sm text-foreground">
                {details.bodyStyle || "—"}
              </p>
            </div>
            <div>
              <span className="text-[10px] text-muted-foreground">
                Fuel Type
              </span>
              <p className="text-sm text-foreground">
                {details.fuelType || "—"}
              </p>
            </div>
            <div>
              <span className="text-[10px] text-muted-foreground">
                Transmission
              </span>
              <p className="text-sm text-foreground">
                {details.transmissionType || "—"}
              </p>
            </div>
            <div>
              <span className="text-[10px] text-muted-foreground">
                Engine #
              </span>
              <p className="font-mono text-sm text-foreground">
                {details.engineNumber || "—"}
              </p>
            </div>
            <div>
              <span className="text-[10px] text-muted-foreground">
                Exterior
              </span>
              <p className="text-sm text-foreground">
                {details.exteriorColor || "—"}
              </p>
            </div>
            <div>
              <span className="text-[10px] text-muted-foreground">
                Interior
              </span>
              <p className="text-sm text-foreground">
                {details.interiorColor || "—"}
              </p>
            </div>
          </div>
        </div>

        <div className="rounded-xl border border-border/60 bg-secondary/20 p-4">
          <h4 className="mb-4 text-xs font-medium uppercase tracking-widest text-muted-foreground">
            Registration
          </h4>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <span className="text-[10px] text-muted-foreground">Plate #</span>
              <p className="font-mono text-sm text-foreground">
                {details.registrationNumber || "—"}
              </p>
            </div>
            <div>
              <span className="text-[10px] text-muted-foreground">State</span>
              <p className="text-sm text-foreground">
                {details.registrationState || "—"}
              </p>
            </div>
            <div className="col-span-2">
              <span className="text-[10px] text-muted-foreground">Title #</span>
              <p className="font-mono text-sm text-foreground">
                {details.titleNumber || "—"}
              </p>
            </div>
          </div>
        </div>
      </div>

      <div>
        <h3 className="mb-4 flex items-center gap-2 text-xs font-medium text-foreground">
          <Wrench className="size-4 text-blue-500" />
          {t("serviceHistory")}
        </h3>

        {details.serviceLog && details.serviceLog.length > 0 ? (
          <div className="space-y-3">
            {details.serviceLog.map((entry, index) => (
              <div
                key={`${entry.serviceDate}-${index}`}
                className="rounded-lg border border-border/60 bg-secondary/20 p-4"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="rounded bg-blue-500/10 px-2 py-0.5 text-[10px] font-medium uppercase text-blue-500">
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
                    <span>{formatCurrency(entry.cost, locale, "USD")}</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="flex h-24 items-center justify-center rounded-xl border border-dashed border-border">
            <p className="text-sm text-muted-foreground">
              {t("noServiceRecords")}
            </p>
          </div>
        )}
      </div>

      <div>
        <h3 className="mb-4 flex items-center gap-2 text-xs font-medium text-foreground">
          <Trophy className="size-4 text-amber-500" />
          {t("eventHistory")}
        </h3>

        {details.eventHistory && details.eventHistory.length > 0 ? (
          <div className="space-y-3">
            {details.eventHistory.map((event, index) => (
              <div
                key={`${event.eventDate}-${index}`}
                className="rounded-lg border border-border/60 bg-secondary/20 p-4"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span
                      className={cn(
                        "rounded px-2 py-0.5 text-[10px] font-medium uppercase",
                        event.eventType === "concours"
                          ? "bg-amber-500/10 text-amber-500"
                          : event.eventType === "race"
                            ? "bg-rose-500/10 text-rose-500"
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
                        className="flex items-center gap-1 rounded bg-amber-500/10 px-2 py-0.5 text-[10px] text-amber-500"
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
          <div className="flex h-24 items-center justify-center rounded-xl border border-dashed border-border">
            <p className="text-sm text-muted-foreground">
              {t("noEventHistory")}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
