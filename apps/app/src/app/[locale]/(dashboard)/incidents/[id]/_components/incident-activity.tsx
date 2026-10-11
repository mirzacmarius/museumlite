"use client";

import { ClientDate } from "@/components/client-date";
import { useCurrentLocale, useScopedI18n } from "@/locales/client";
import { DATE_TIME } from "../../_components/incident-format";
import { type IncidentDetail, Section } from "./incident-detail-client";

type IncidentEvent = IncidentDetail["events"][number];

/** The incident's own log, newest first; only people in scope can read it. */
export function IncidentActivity({ incident }: { incident: IncidentDetail }) {
  const t = useScopedI18n("incidents.activity");
  const locale = useCurrentLocale();
  return (
    <Section id="incident-activity" title={t("title")}>
      <ol className="space-y-3">
        {incident.events.map((event) => (
          <li key={event.ordinal} className="border-l-2 border-border pl-3">
            <p className="text-sm">
              <EventText event={event} />
            </p>
            {event.note ? (
              <p className="whitespace-pre-wrap text-sm text-muted-foreground">
                {event.note}
              </p>
            ) : null}
            <p className="text-xs text-muted-foreground">
              {event.actorName ?? "-"} ·{" "}
              <ClientDate
                timestamp={event.at}
                locale={locale}
                options={DATE_TIME}
              />
            </p>
          </li>
        ))}
      </ol>
    </Section>
  );
}

function EventText({ event }: { event: IncidentEvent }) {
  const t = useScopedI18n("incidents.activity");
  const tIncidents = useScopedI18n("incidents");
  const object = event.objectTitle ?? "-";
  switch (event.action) {
    case "reported":
      return t("reported", { count: event.count ?? 0 });
    case "report_repeated":
      return t("reportRepeated");
    case "triaged":
    case "response_updated":
      return t(event.action, {
        severity: event.value
          ? tIncidents(
              `severities.${event.value as "minor" | "moderate" | "major" | "critical"}`,
            )
          : "-",
        lead: event.userName ?? "-",
      });
    case "plans_applied":
      return t("plansApplied", {
        plans: event.value ?? "-",
        count: event.count ?? 0,
      });
    case "objects_added":
      return t("objectsAdded", { count: event.count ?? 0 });
    case "impact_changed":
      return t("impactChanged", {
        object,
        impact: event.value
          ? tIncidents(
              `impacts.${event.value as "at_risk" | "damaged" | "missing" | "unaffected"}`,
            )
          : "-",
      });
    case "evacuated":
    case "recovered":
      return t(event.action, {
        object,
        from: event.fromLocationName ?? "-",
        to: event.toLocationName ?? "-",
      });
    case "evidence_linked":
      return t("evidenceLinked");
    case "evidence_retracted":
      return t("evidenceRetracted");
    case "closed":
      return t("closed");
    case "reopened":
      return t("reopened");
  }
}
