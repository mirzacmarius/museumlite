"use client";

import { api } from "@v1/backend/convex/_generated/api";
import type { Id } from "@v1/backend/convex/_generated/dataModel";
import { Button } from "@v1/ui/button";
import { useQuery } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import { ArrowLeft, Loader2 } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import { CaseTaskPanel } from "@/components/case-tasks/case-task-panel";
import { ClientDate } from "@/components/client-date";
import {
  RecordRecoveryState,
  useBackToResultsLink,
} from "@/components/record-recovery-state";
import { useRecordViewState } from "@/hooks/use-return-path";
import { useCurrentLocale, useScopedI18n } from "@/locales/client";
import {
  IncidentSeverityBadge,
  IncidentStatusBadge,
  SensitiveBadge,
} from "../../_components/incident-badges";
import { DATE_TIME } from "../../_components/incident-format";
import { IncidentActivity } from "./incident-activity";
import { IncidentAfterAction } from "./incident-after-action";
import { IncidentEvidence } from "./incident-evidence";
import { IncidentObjects } from "./incident-objects";
import { IncidentResponse } from "./incident-response";

export type IncidentDetail = NonNullable<
  FunctionReturnType<typeof api.incidents.get>
>;

export function Field({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <div>
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="whitespace-pre-wrap break-words text-sm">{children}</dd>
    </div>
  );
}

export function Section({
  id,
  title,
  action,
  children,
}: {
  id: string;
  title: string;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section
      aria-labelledby={id}
      className="space-y-4 rounded-xl border border-border bg-card p-4 sm:p-6"
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 id={id} className="text-lg font-medium">
          {title}
        </h2>
        {action}
      </div>
      {children}
    </section>
  );
}

export function IncidentDetailClient({
  incidentId,
}: {
  incidentId: Id<"incidents">;
}) {
  const t = useScopedI18n("incidents");
  const locale = useCurrentLocale();
  const incident = useQuery(api.incidents.get, { incidentId });
  const viewState = useRecordViewState(incident);
  const back = useBackToResultsLink("incidents");

  if (incident === undefined) {
    return (
      <div className="flex size-full items-center justify-center bg-background">
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
      </div>
    );
  }
  if (incident === null) {
    return (
      <RecordRecoveryState
        kind={viewState === "removed" ? "removed" : "missing"}
        list="incidents"
      />
    );
  }

  const notRecorded = t("notRecorded");
  return (
    <div className="mx-auto w-full max-w-5xl space-y-6 p-4 sm:p-6">
      <div className="space-y-3">
        <Button
          variant="ghost"
          size="sm"
          asChild
          className="-ml-3 text-muted-foreground hover:text-foreground"
        >
          <Link href={back.href}>
            <ArrowLeft className="mr-2 size-4" aria-hidden="true" />
            {back.label}
          </Link>
        </Button>
        <div className="space-y-2">
          <p className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
            <span className="font-mono">{incident.incidentNumber}</span>
            <span>{t(`kinds.${incident.kind}`)}</span>
          </p>
          <h1 className="break-words text-xl font-medium tracking-tight sm:text-2xl">
            {incident.title}
          </h1>
          <div className="flex flex-wrap items-center gap-2">
            <IncidentStatusBadge status={incident.status} />
            <IncidentSeverityBadge severity={incident.severity} />
            {incident.sensitive ? <SensitiveBadge /> : null}
          </div>
        </div>
      </div>

      <Section id="incident-report" title={t("detail.reportTitle")}>
        <dl className="grid gap-4 sm:grid-cols-2">
          <Field label={t("detail.discoveredAt")}>
            <ClientDate
              timestamp={incident.discoveredAt}
              locale={locale}
              options={DATE_TIME}
            />
          </Field>
          <Field label={t("detail.occurredAt")}>
            {incident.occurredAt ? (
              <ClientDate
                timestamp={incident.occurredAt}
                locale={locale}
                options={DATE_TIME}
              />
            ) : (
              notRecorded
            )}
          </Field>
          <Field label={t("detail.reportedBy")}>
            {incident.reportedByName ?? notRecorded} ·{" "}
            <ClientDate
              timestamp={incident.reportedAt}
              locale={locale}
              options={DATE_TIME}
            />
          </Field>
          <Field label={t("detail.locations")}>
            {incident.locations.length === 0
              ? notRecorded
              : incident.locations.map((location, index) => (
                  <span key={location._id}>
                    {index > 0 ? ", " : null}
                    <Link
                      href={`/locations/${location._id}`}
                      className="underline-offset-2 hover:underline"
                    >
                      {location.name}
                    </Link>
                  </span>
                ))}
          </Field>
          {incident.source ? (
            <Field label={t("detail.source")}>
              <Link
                href={`/locations/episodes/${incident.source.episodeId}`}
                className="underline-offset-2 hover:underline"
              >
                {t("detail.alertEpisode")}
              </Link>
            </Field>
          ) : null}
          {incident.description ? (
            <div className="sm:col-span-2">
              <Field label={t("detail.details")}>{incident.description}</Field>
            </div>
          ) : null}
        </dl>
      </Section>

      <IncidentResponse incident={incident} />
      <IncidentObjects incident={incident} />
      <CaseTaskPanel
        organizationId={incident.organizationId}
        caseType="incident"
        caseId={incident._id}
      />
      <IncidentEvidence incident={incident} />
      <IncidentAfterAction incident={incident} />
      <IncidentActivity incident={incident} />
    </div>
  );
}
