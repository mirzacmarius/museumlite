"use client";

import { api } from "@v1/backend/convex/_generated/api";
import type { Id } from "@v1/backend/convex/_generated/dataModel";
import { Button } from "@v1/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@v1/ui/tabs";
import { usePaginatedQuery } from "convex/react";
import { Loader2, Plus, Siren } from "lucide-react";
import Link from "next/link";
import { parseAsStringLiteral, useQueryState } from "nuqs";
import { useState } from "react";
import { ClientDate } from "@/components/client-date";
import { useCurrentLocale, useScopedI18n } from "@/locales/client";
import {
  IncidentSeverityBadge,
  IncidentStatusBadge,
  SensitiveBadge,
} from "./incident-badges";
import { DATE_TIME } from "./incident-format";
import { ReportIncidentDialog } from "./report-incident-dialog";

const FILTERS = ["open", "closed"] as const;
const PAGE_SIZE = 25;

export function IncidentsPageClient({
  organizationId,
}: {
  organizationId: Id<"organizations">;
}) {
  const t = useScopedI18n("incidents");
  const [filter, setFilter] = useQueryState(
    "status",
    parseAsStringLiteral(FILTERS)
      .withDefault("open")
      .withOptions({ history: "replace", scroll: false }),
  );
  const [reporting, setReporting] = useState(false);

  return (
    <div className="flex size-full flex-col overflow-y-auto bg-background">
      <div className="mx-auto w-full max-w-7xl space-y-6 p-4 sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex flex-col gap-2">
            <h1 className="page-title">{t("title")}</h1>
            <p className="page-description max-w-3xl">{t("description")}</p>
          </div>
          <Button onClick={() => setReporting(true)}>
            <Plus className="mr-1 size-4" aria-hidden="true" />
            {t("reportAction")}
          </Button>
        </div>
        <Tabs
          value={filter}
          onValueChange={(value) =>
            void setFilter(value === "closed" ? "closed" : null)
          }
        >
          <TabsList>
            <TabsTrigger value="open">{t("filters.open")}</TabsTrigger>
            <TabsTrigger value="closed">{t("filters.closed")}</TabsTrigger>
          </TabsList>
        </Tabs>
        <IncidentList organizationId={organizationId} filter={filter} />
      </div>
      <ReportIncidentDialog
        organizationId={organizationId}
        open={reporting}
        onOpenChange={setReporting}
      />
    </div>
  );
}

function IncidentList({
  organizationId,
  filter,
}: {
  organizationId: Id<"organizations">;
  filter: (typeof FILTERS)[number];
}) {
  const t = useScopedI18n("incidents");
  const locale = useCurrentLocale();
  const { results, status, loadMore } = usePaginatedQuery(
    api.incidents.list,
    { organizationId, filter },
    { initialNumItems: PAGE_SIZE },
  );

  if (status === "LoadingFirstPage") {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="size-4 animate-spin" aria-hidden="true" />
        {t("loading")}
      </div>
    );
  }

  if (results.length === 0 && status === "Exhausted") {
    return (
      <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed border-border p-10 text-center">
        <Siren className="size-6 text-muted-foreground" aria-hidden="true" />
        <p className="text-sm text-muted-foreground">
          {filter === "open" ? t("emptyOpen") : t("emptyClosed")}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <ul className="divide-y divide-border rounded-xl border border-border bg-card">
        {results.map((incident) => (
          <li key={incident._id}>
            <Link
              href={`/incidents/${incident._id}`}
              className="flex flex-col gap-2 p-4 hover:bg-muted/40 focus-visible:bg-muted/40 focus-visible:outline-none sm:flex-row sm:items-center sm:justify-between"
            >
              <div className="min-w-0 space-y-1">
                <p className="flex flex-wrap items-center gap-2 text-sm">
                  <span className="font-mono text-muted-foreground">
                    {incident.incidentNumber}
                  </span>
                  <span className="text-muted-foreground">
                    {t(`kinds.${incident.kind}`)}
                  </span>
                </p>
                <p className="break-words font-medium">{incident.title}</p>
                <p className="text-xs text-muted-foreground">
                  {t("reportedOn")}{" "}
                  <ClientDate
                    timestamp={incident.reportedAt}
                    locale={locale}
                    options={DATE_TIME}
                  />
                  {incident.leadName
                    ? ` · ${t("leadIs", { name: incident.leadName })}`
                    : null}
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                {incident.sensitive ? <SensitiveBadge /> : null}
                <IncidentSeverityBadge severity={incident.severity} />
                <IncidentStatusBadge status={incident.status} />
              </div>
            </Link>
          </li>
        ))}
      </ul>
      {status === "CanLoadMore" || status === "LoadingMore" ? (
        <Button
          variant="outline"
          disabled={status === "LoadingMore"}
          onClick={() => loadMore(PAGE_SIZE)}
        >
          {t("loadMore")}
        </Button>
      ) : null}
    </div>
  );
}
