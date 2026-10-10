"use client";

import { api } from "@v1/backend/convex/_generated/api";
import { Badge } from "@v1/ui/badge";
import { useQuery } from "convex/react";
import { ArrowLeft, ExternalLink } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import { CaseTaskPanel } from "@/components/case-tasks/case-task-panel";
import { usePermissions } from "@/components/permission-gate";
import {
  RecordRecoveryState,
  useBackToResultsLink,
} from "@/components/record-recovery-state";
import { useRecordViewState } from "@/hooks/use-return-path";
import { useScopedI18n } from "@/locales/client";
import {
  FindingStatusBadge,
  FindingSummary,
} from "../../_components/finding-summary";
import {
  type FindingRecord,
  type FindingView,
  orphanFieldTab,
  recordHref,
  requirementsByTab,
} from "../../_components/quality-repair";
import { FindingReview } from "./finding-review";

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="whitespace-pre-wrap break-words text-sm">{children}</dd>
    </div>
  );
}

function Section({
  id,
  title,
  children,
}: {
  id: string;
  title: string;
  children: ReactNode;
}) {
  return (
    <section
      aria-labelledby={id}
      className="space-y-3 rounded-xl border border-border bg-card p-6"
    >
      <h2 id={id} className="text-lg font-medium">
        {title}
      </h2>
      {children}
    </section>
  );
}

/** What the check recorded, exactly as it found it. */
function WhatWasFound({ view }: { view: FindingView }) {
  const t = useScopedI18n("documentationQuality");
  const tParties = useScopedI18n("parties");
  const { finding } = view;
  const notRecorded = t("detail.notRecorded");
  switch (finding.kind) {
    case "duplicate_identifier":
      return (
        <dl className="grid gap-3 sm:grid-cols-2">
          <Field label={t("detail.register")}>
            {t(`registers.${finding.register}`)}
          </Field>
          <Field label={t("detail.identifier")}>{finding.identifier}</Field>
          <div className="sm:col-span-2">
            <Field label={t("detail.records", { count: finding.recordCount })}>
              <ul className="space-y-1">
                {finding.records.map((record) => (
                  <li key={record.id}>
                    <span className="font-mono">“{record.identifier}”</span>
                    {record.label ? ` · ${record.label}` : null}
                  </li>
                ))}
              </ul>
              {finding.recordCount > finding.records.length ? (
                <p className="text-xs text-muted-foreground">
                  {t("detail.moreRecords", {
                    count: finding.recordCount - finding.records.length,
                  })}
                </p>
              ) : null}
            </Field>
          </div>
        </dl>
      );
    case "missing_evidence":
      return (
        <dl className="grid gap-3 sm:grid-cols-2">
          <Field label={t("detail.object")}>
            {finding.objectIdentifier} · {finding.objectTitle}
          </Field>
          <Field label={t("detail.profile")}>{finding.profileName}</Field>
          <Field label={t("detail.stage")}>
            {t(`stages.${finding.stage}`)}
          </Field>
          <Field label={t("detail.missing")}>
            {finding.missing
              .map((requirement) => t(`requirements.${requirement}`))
              .join(", ")}
          </Field>
          {finding.recorded?.condition ? (
            <div className="sm:col-span-2">
              <Field label={t("detail.recordedCondition")}>
                {finding.recorded.condition}
              </Field>
            </div>
          ) : null}
          {finding.recorded?.provenance ? (
            <div className="sm:col-span-2">
              <Field label={t("detail.recordedProvenance")}>
                {finding.recorded.provenance}
              </Field>
            </div>
          ) : null}
        </dl>
      );
    case "legacy_link":
      return (
        <dl className="grid gap-3 sm:grid-cols-2">
          <Field label={t("detail.record")}>
            {t(`recordTypes.${finding.target.type}`)} {finding.label}
          </Field>
          <Field label={t("detail.assertedName")}>
            {finding.assertedName ?? notRecorded}
          </Field>
          <Field label={t("detail.existingParty")}>
            {view.existingPartyName ?? notRecorded}
          </Field>
          <Field label={t("detail.suggestedRole")}>
            {tParties(`roles.${finding.suggestedRole}`)}
          </Field>
        </dl>
      );
    case "orphan_reference":
      return (
        <dl className="grid gap-3 sm:grid-cols-2">
          <Field label={t("detail.record")}>
            {t(`recordTypes.${finding.subject.type}`)} {finding.label}
          </Field>
          <Field label={t("detail.field")}>
            {t(`orphanFields.${finding.field}`)}
          </Field>
          <Field label={t("detail.storedReference")}>
            <span className="font-mono text-xs">{finding.referencedId}</span>
          </Field>
          <Field label={t("detail.problem")}>
            {t(`orphanProblems.${finding.problem}`)}
          </Field>
        </dl>
      );
  }
}

function RecordLink({
  record,
  tab,
  children,
}: {
  record: FindingRecord;
  tab?: Parameters<typeof recordHref>[1];
  children: ReactNode;
}) {
  const t = useScopedI18n("documentationQuality.detail");
  if (!record.available)
    return (
      <span className="text-muted-foreground">
        {t("recordUnavailable", { record: record.label || record.id })}
      </span>
    );
  return (
    <Link
      href={recordHref(record, tab)}
      className="inline-flex items-center gap-1 underline underline-offset-2"
    >
      {children}
      <ExternalLink className="size-3" />
    </Link>
  );
}

/** Where staff repair the record; checks never repair records themselves. */
function WhereToRepair({ view }: { view: FindingView }) {
  const t = useScopedI18n("documentationQuality");
  const { hasPermission } = usePermissions();
  const { finding, records } = view;
  const recordName = (record: FindingRecord) =>
    `${t(`recordTypes.${record.type}`)} ${record.label}${record.title ? ` · ${record.title}` : ""}`;
  let links: ReactNode;
  switch (finding.kind) {
    case "missing_evidence": {
      const [record] = records;
      links = record
        ? requirementsByTab(finding.missing).map(({ tab, requirements }) => (
            <li key={tab}>
              <RecordLink record={record} tab={tab}>
                {t("detail.openTab", {
                  tab: t(`objectTabs.${tab}`),
                  requirements: requirements
                    .map((requirement) => t(`requirements.${requirement}`))
                    .join(", "),
                })}
              </RecordLink>
            </li>
          ))
        : null;
      break;
    }
    case "orphan_reference":
      links = records.map((record) => (
        <li key={record.id}>
          <RecordLink record={record} tab={orphanFieldTab(finding.field)}>
            {recordName(record)}
          </RecordLink>
        </li>
      ));
      break;
    default:
      links = records.map((record) => (
        <li key={record.id}>
          <RecordLink record={record}>{recordName(record)}</RecordLink>
        </li>
      ));
  }
  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">
        {finding.kind === "duplicate_identifier"
          ? t("detail.duplicateHint")
          : t("detail.repairIntro")}
      </p>
      <ul className="space-y-2 text-sm">{links}</ul>
      {finding.kind === "legacy_link" ? (
        <p className="text-xs text-muted-foreground">
          {view.canLinkParties
            ? t("detail.linkPartyHint")
            : t("detail.linkPartyUnavailable")}
        </p>
      ) : null}
      {finding.kind === "duplicate_identifier" &&
      hasPermission("organization.manage_settings") ? (
        <Link
          href="/settings/preferences"
          className="inline-block text-xs underline underline-offset-2"
        >
          {t("detail.identifierRegister")}
        </Link>
      ) : null}
    </div>
  );
}

function FindingDetail({ view }: { view: FindingView }) {
  const t = useScopedI18n("documentationQuality");
  const back = useBackToResultsLink("documentationQuality");
  const { finding } = view;

  return (
    <div className="mx-auto w-full max-w-4xl space-y-6 p-4 sm:p-6">
      <div className="space-y-2">
        <Link
          href={back.href}
          className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="size-4" />
          {back.fromResults ? back.label : t("detail.back")}
        </Link>
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="outline">{t(`kinds.${finding.kind}`)}</Badge>
          <FindingStatusBadge status={finding.status} />
        </div>
        <h1 className="break-words text-lg font-semibold">
          <FindingSummary finding={finding} />
        </h1>
        <p className="text-xs text-muted-foreground">
          {t("detail.detection", {
            first: finding.firstCheckNumber,
            last: finding.lastCheckNumber,
          })}
        </p>
      </div>
      <Section id="finding-found-title" title={t("detail.foundTitle")}>
        <WhatWasFound view={view} />
      </Section>
      <Section id="finding-repair-title" title={t("detail.repairTitle")}>
        <WhereToRepair view={view} />
      </Section>
      <FindingReview view={view} />
      <CaseTaskPanel
        organizationId={finding.organizationId}
        caseType="documentationFinding"
        caseId={finding._id}
      />
    </div>
  );
}

export function FindingDetailClient({ findingId }: { findingId: string }) {
  const view = useQuery(api.documentationQuality.getFinding, { findingId });
  const viewState = useRecordViewState(view);

  if (view === undefined)
    return (
      <div className="flex size-full items-center justify-center">
        <div className="h-8 w-48 animate-pulse rounded-md bg-muted/60" />
      </div>
    );
  if (view === null)
    return (
      <RecordRecoveryState
        kind={viewState === "removed" ? "removed" : "missing"}
        list="documentationQuality"
      />
    );
  return <FindingDetail view={view} />;
}
