"use client";

import { api } from "@v1/backend/convex/_generated/api";
import type { Id } from "@v1/backend/convex/_generated/dataModel";
import { Badge } from "@v1/ui/badge";
import { Button } from "@v1/ui/button";
import { useQuery } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import { ArrowLeft, ExternalLink, Printer } from "lucide-react";
import Link from "next/link";
import { type ReactNode, useState } from "react";
import { CaseTaskPanel } from "@/components/case-tasks/case-task-panel";
import {
  LabelSheetDialog,
  recordLabelUrl,
} from "@/components/label-sheet-dialog";
import { RecordRecoveryState } from "@/components/record-recovery-state";
import { useRecordViewState } from "@/hooks/use-return-path";
import { useCurrentLocale, useScopedI18n } from "@/locales/client";
import { ExceptionSummary } from "../../../_components/exception-summary";
import { formatMoment } from "../../../_components/inventory-format";
import { ExceptionReview } from "./exception-review";

export type ExceptionView = NonNullable<
  FunctionReturnType<typeof api.inventory.getException>
>;

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="whitespace-pre-wrap break-words text-sm">{children}</dd>
    </div>
  );
}

function WhatWasObserved({ view }: { view: ExceptionView }) {
  const t = useScopedI18n("inventory.exception");
  const tMethods = useScopedI18n("inventory.observations.methods");
  const locale = useCurrentLocale();
  const notRecorded = t("notRecorded");
  return (
    <dl className="grid gap-3 sm:grid-cols-2">
      {view.collectionId ? (
        <Field label={t("object")}>
          {view.accessionNumber ?? view.label}
          {view.title ? ` · ${view.title}` : ""}
        </Field>
      ) : (
        <Field label={t("scannedValue")}>
          <span className="break-all font-mono">{view.scannedValue}</span>
        </Field>
      )}
      <Field label={t("session")}>
        <Link
          href={`/inventory/${view.sessionId}?tab=exceptions`}
          className="underline underline-offset-2"
        >
          {view.sessionName}
        </Link>
      </Field>
      {view.kind !== "unknown_label" ? (
        <Field label={t("recordedLocation")}>
          {view.recordedLocationName ?? notRecorded}
        </Field>
      ) : null}
      <Field label={t("observedLocation")}>
        {view.observedLocationName ?? notRecorded}
      </Field>
      {view.observedAt ? (
        <Field label={t("observedBy")}>
          {`${view.observedByName ?? notRecorded}, ${formatMoment(view.observedAt, locale)}`}
        </Field>
      ) : null}
      {view.observationMethod ? (
        <Field label={t("method")}>{tMethods(view.observationMethod)}</Field>
      ) : null}
      {view.observationNote ? (
        <div className="sm:col-span-2">
          <Field label={t("note")}>{view.observationNote}</Field>
        </div>
      ) : null}
    </dl>
  );
}

function ExceptionDetail({ view }: { view: ExceptionView }) {
  const t = useScopedI18n("inventory");
  const locale = useCurrentLocale();
  const [reprinting, setReprinting] = useState(false);

  return (
    <div className="mx-auto w-full max-w-4xl space-y-6 p-4 sm:p-6">
      <div className="space-y-2">
        <Link
          href={`/inventory/${view.sessionId}?tab=exceptions`}
          className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="size-4" />
          {t("exception.back")}
        </Link>
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="outline">{t(`exceptions.kinds.${view.kind}`)}</Badge>
          <Badge variant={view.status === "open" ? "default" : "secondary"}>
            {t(`exceptions.statuses.${view.status}`)}
          </Badge>
        </div>
        <h1 className="break-words text-lg font-semibold">
          <span className="font-mono">{view.label}</span>
          {" · "}
          <ExceptionSummary exception={view} />
        </h1>
      </div>

      <section
        aria-labelledby="inventory-exception-found"
        className="space-y-3 rounded-xl border border-border bg-card p-6"
      >
        <h2 id="inventory-exception-found" className="text-lg font-medium">
          {t("exception.foundTitle")}
        </h2>
        <WhatWasObserved view={view} />
        {view.collectionId ? (
          <div className="flex flex-wrap gap-2">
            <Button asChild size="sm" variant="outline">
              <Link href={`/objects/${view.collectionId}`}>
                <ExternalLink className="mr-2 size-4" />
                {t("exception.openObject")}
              </Link>
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => setReprinting(true)}
            >
              <Printer className="mr-2 size-4" />
              {t("exception.reprintLabel")}
            </Button>
          </div>
        ) : null}
      </section>

      <ExceptionReview view={view} />

      <CaseTaskPanel
        organizationId={view.organizationId}
        caseType="inventoryException"
        caseId={view._id}
      />

      {reprinting && view.collectionId ? (
        <LabelSheetDialog
          open
          onOpenChange={(open) => {
            if (!open) setReprinting(false);
          }}
          title={t("exception.reprintTitle")}
          description={t("exception.reprintDescription", {
            label: view.accessionNumber ?? view.label,
          })}
          labels={[
            {
              accessionNumber: view.accessionNumber ?? view.label,
              title: view.title ?? "",
              qrCodeUrl: recordLabelUrl(locale, "objects", view.collectionId),
            },
          ]}
          idPrefix="inventory-reprint"
        />
      ) : null}
    </div>
  );
}

export function ExceptionDetailClient({
  exceptionId,
}: {
  exceptionId: string;
}) {
  const view = useQuery(api.inventory.getException, {
    exceptionId: exceptionId as Id<"inventoryExceptions">,
  });
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
        list="inventory"
      />
    );
  return <ExceptionDetail view={view} />;
}
