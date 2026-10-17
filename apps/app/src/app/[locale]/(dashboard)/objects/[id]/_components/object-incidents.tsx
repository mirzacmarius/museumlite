"use client";

import { api } from "@v1/backend/convex/_generated/api";
import type { Id } from "@v1/backend/convex/_generated/dataModel";
import { Button } from "@v1/ui/button";
import { useQuery } from "convex/react";
import { Siren } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { ClientDate } from "@/components/client-date";
import { useCurrentLocale, useScopedI18n } from "@/locales/client";
import {
  IncidentSeverityBadge,
  IncidentStatusBadge,
  SensitiveBadge,
} from "../../../incidents/_components/incident-badges";
import { DATE_TIME } from "../../../incidents/_components/incident-format";
import { ReportIncidentDialog } from "../../../incidents/_components/report-incident-dialog";

/** Incidents this object is linked to that the viewer may see. */
export function ObjectIncidents({
  collectionId,
  organizationId,
}: {
  collectionId: Id<"collections">;
  organizationId: Id<"organizations">;
}) {
  const t = useScopedI18n("incidents");
  const locale = useCurrentLocale();
  const incidents = useQuery(api.incidents.listForObject, { collectionId });
  const [reporting, setReporting] = useState(false);

  return (
    <section
      aria-labelledby="object-incidents-heading"
      className="space-y-3 rounded-xl border border-border/60 bg-card p-4 sm:p-6"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3
          id="object-incidents-heading"
          className="flex items-center gap-2 text-sm font-semibold text-foreground"
        >
          <Siren className="size-4 text-muted-foreground" aria-hidden="true" />
          {t("title")}
        </h3>
        <Button size="sm" variant="outline" onClick={() => setReporting(true)}>
          {t("reportAction")}
        </Button>
      </div>
      {incidents === undefined ? null : incidents.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t("objectNone")}</p>
      ) : (
        <ul className="space-y-2">
          {incidents.map((incident) => (
            <li
              key={incident._id}
              className="flex flex-wrap items-center justify-between gap-2"
            >
              <Link
                href={`/incidents/${incident._id}`}
                className="min-w-0 break-words text-sm underline-offset-2 hover:underline"
              >
                <span className="font-mono text-muted-foreground">
                  {incident.incidentNumber}
                </span>{" "}
                {incident.title} ·{" "}
                <ClientDate
                  timestamp={incident.reportedAt}
                  locale={locale}
                  options={DATE_TIME}
                />
              </Link>
              <span className="flex flex-wrap gap-2">
                {incident.sensitive ? <SensitiveBadge /> : null}
                <IncidentSeverityBadge severity={incident.severity} />
                <IncidentStatusBadge status={incident.status} />
              </span>
            </li>
          ))}
        </ul>
      )}
      <ReportIncidentDialog
        organizationId={organizationId}
        open={reporting}
        onOpenChange={setReporting}
        defaultObjectIds={[collectionId]}
      />
    </section>
  );
}
