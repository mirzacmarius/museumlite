"use client";

import { api } from "@v1/backend/convex/_generated/api";
import { isOpenEntryStatus } from "@v1/backend/convex/utils/objectEntryValidators";
import { Button } from "@v1/ui/button";
import { useQuery } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { type ReactNode, useState } from "react";
import { ClientDateFns } from "@/components/client-date";
import { usePermissions } from "@/components/permission-gate";
import {
  RecordRecoveryState,
  useBackToResultsLink,
} from "@/components/record-recovery-state";
import { TargetPartyLinks } from "@/components/target-party-links";
import { useClientDateFns } from "@/hooks/use-client-date-format";
import { useRecordViewState } from "@/hooks/use-return-path";
import { useCurrentLocale, useScopedI18n } from "@/locales/client";
import { EntryStatusBadge } from "../../_components/entry-status-badge";
import { BeginAcquisitionDialog } from "./begin-acquisition-dialog";
import { EditEntryDialog } from "./edit-entry-dialog";
import { RecordExitDialog } from "./record-exit-dialog";
import { WithdrawAcquisitionDialog } from "./withdraw-acquisition-dialog";

type EntryView = NonNullable<FunctionReturnType<typeof api.objectEntries.get>>;
type OpenDialog = "acquisition" | "withdraw" | "exit" | "edit" | null;

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="whitespace-pre-wrap text-sm">{children}</dd>
    </div>
  );
}

export function EntryDetailClient({ entryId }: { entryId: string }) {
  const entry = useQuery(api.objectEntries.get, { entryId });
  const viewState = useRecordViewState(entry);

  if (entry === undefined) {
    return (
      <div className="flex size-full items-center justify-center">
        <div className="h-8 w-48 animate-pulse rounded-md bg-muted/60" />
      </div>
    );
  }
  if (entry === null) {
    return (
      <RecordRecoveryState
        kind={viewState === "removed" ? "removed" : "missing"}
        list="entries"
      />
    );
  }
  return <EntryDetail entry={entry} />;
}

function EntryDetail({ entry }: { entry: EntryView }) {
  const t = useScopedI18n("objectEntries");
  const locale = useCurrentLocale();
  const { hasPermission } = usePermissions();
  const [openDialog, setOpenDialog] = useState<OpenDialog>(null);
  const back = useBackToResultsLink("entries");
  const canUpdate =
    isOpenEntryStatus(entry.status) && hasPermission("collections.update");
  const canBeginAcquisition =
    entry.status === "in_custody" && entry.canInitiateAcquisition;
  const canWithdrawAcquisition =
    entry.status === "acquisition_review" &&
    entry.accession?.isDraft === true &&
    entry.canInitiateAcquisition;
  const canRecordExit =
    entry.status === "in_custody" && hasPermission("collections.update");
  const date = (timestamp: number | undefined) =>
    timestamp === undefined ? (
      t("detail.notRecorded")
    ) : (
      <ClientDateFns
        timestamp={timestamp}
        format="MMM d, yyyy"
        locale={locale}
      />
    );
  const closeDialog = (open: boolean) => {
    if (!open) setOpenDialog(null);
  };
  const accessionedOn = useClientDateFns(
    entry.accessionedAt,
    "MMM d, yyyy",
    locale,
  );

  return (
    <div className="mx-auto w-full max-w-4xl space-y-6 p-6">
      <div>
        <Link
          href={back.href}
          className="mb-3 inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="size-4" />
          {back.fromResults ? back.label : t("detail.back")}
        </Link>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-lg font-semibold">{entry.entryNumber}</h1>
              <EntryStatusBadge status={entry.status} />
            </div>
            <p className="text-sm text-muted-foreground">
              {entry.object?.title} · {t(`purposes.${entry.purpose}`)}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {canUpdate ? (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setOpenDialog("edit")}
              >
                {t("actions.edit")}
              </Button>
            ) : null}
            {canRecordExit ? (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setOpenDialog("exit")}
              >
                {t("actions.recordExit")}
              </Button>
            ) : null}
            {canBeginAcquisition && entry.ownerName ? (
              <Button size="sm" onClick={() => setOpenDialog("acquisition")}>
                {t("actions.beginAcquisition")}
              </Button>
            ) : null}
          </div>
        </div>
        {canBeginAcquisition && !entry.ownerName ? (
          <p className="mt-2 text-xs text-muted-foreground">
            {t("detail.ownerNeeded")}
          </p>
        ) : null}
      </div>

      <section className="grid gap-4 rounded-2xl border border-border/60 p-4 sm:grid-cols-2">
        <dl className="space-y-3">
          <Field label={t("fields.depositor")}>{entry.depositorName}</Field>
          <Field label={t("fields.owner")}>
            {entry.ownerName ?? t("detail.ownerNotRecorded")}
          </Field>
          <Field label={t("fields.purpose")}>
            {t(`purposes.${entry.purpose}`)}
            {entry.purposeNote ? `\n${entry.purposeNote}` : null}
          </Field>
          <Field label={t("fields.receivedAt")}>
            {date(entry.receivedAt)}
            {entry.receivedByName
              ? ` · ${t("detail.receivedBy", { name: entry.receivedByName })}`
              : null}
          </Field>
          <Field label={t("fields.condition")}>{entry.conditionAtEntry}</Field>
        </dl>
        <dl className="space-y-3">
          <Field label={t("detail.object")}>
            {entry.object ? (
              <Link
                href={`/objects/${entry.object._id}`}
                className="underline-offset-2 hover:underline"
              >
                {entry.object.identifier} · {entry.object.title}
              </Link>
            ) : (
              t("detail.notRecorded")
            )}
          </Field>
          <Field label={t("fields.location")}>
            {entry.receivedLocationName ?? t("detail.noLocation")}
          </Field>
          <Field label={t("detail.currentLocation")}>
            {entry.object?.currentLocationName ?? t("detail.noLocation")}
          </Field>
          <Field label={t("fields.responsible")}>
            {entry.responsibleName ?? t("detail.notRecorded")}
          </Field>
          <Field label={t("fields.responsibilityTerms")}>
            {entry.responsibilityTerms ?? t("detail.notRecorded")}
          </Field>
          <Field label={t("fields.decisionDueAt")}>
            {date(entry.decisionDueAt)}
          </Field>
          <Field label={t("fields.returnDueAt")}>
            {date(entry.returnDueAt)}
          </Field>
          {entry.notes ? (
            <Field label={t("fields.notes")}>{entry.notes}</Field>
          ) : null}
        </dl>
      </section>

      <section className="rounded-2xl border border-border/60 p-4">
        <h2 className="text-sm font-semibold">{t("detail.acquisition")}</h2>
        {entry.accession ? (
          <div className="mt-2 space-y-1 text-sm">
            <Link
              href={`/accessions/${entry.accession._id}`}
              className="font-medium underline-offset-2 hover:underline"
            >
              {t("detail.openAccession", {
                number: entry.accession.accessionNumber,
              })}
            </Link>
            <p className="text-muted-foreground">
              {entry.status === "accessioned"
                ? t("detail.accessionedOn", { date: accessionedOn })
                : entry.accession.status === "withdrawn"
                  ? t("detail.acquisitionWithdrawn")
                  : entry.accession.isDraft
                    ? t("detail.acquisitionDraft")
                    : t("detail.acquisitionPending")}
            </p>
            {canWithdrawAcquisition ? (
              <Button
                variant="outline"
                size="sm"
                className="mt-2"
                onClick={() => setOpenDialog("withdraw")}
              >
                {t("actions.withdrawAcquisition")}
              </Button>
            ) : null}
          </div>
        ) : (
          <p className="mt-2 text-sm text-muted-foreground">
            {t("detail.noAcquisition")}
          </p>
        )}
      </section>

      {entry.exit ? (
        <section className="rounded-2xl border border-border/60 p-4">
          <h2 className="text-sm font-semibold">{t("detail.exit")}</h2>
          <dl className="mt-2 space-y-2">
            <Field label={t("exitDialog.recipient")}>
              {t("detail.exitedTo", { name: entry.exit.recipientName })}
            </Field>
            <Field label={t("exitDialog.exitedAt")}>
              {date(entry.exit.exitedAt)}
            </Field>
            {entry.exit.reference ? (
              <Field label={t("detail.reference")}>
                {entry.exit.reference}
              </Field>
            ) : null}
            {entry.exit.notes ? (
              <Field label={t("exitDialog.notes")}>{entry.exit.notes}</Field>
            ) : null}
          </dl>
          {entry.exit.recordedByName ? (
            <p className="mt-2 text-xs text-muted-foreground">
              {t("detail.recordedBy", { name: entry.exit.recordedByName })}
            </p>
          ) : null}
        </section>
      ) : null}

      <TargetPartyLinks
        target={{ type: "entry", id: entry._id }}
        organizationId={entry.organizationId}
        writePermission="collections.update"
      />

      {canBeginAcquisition &&
      entry.ownerName &&
      openDialog === "acquisition" ? (
        <BeginAcquisitionDialog
          entryId={entry._id}
          ownerName={entry.ownerName}
          onOpenChange={closeDialog}
        />
      ) : null}
      {canWithdrawAcquisition && openDialog === "withdraw" ? (
        <WithdrawAcquisitionDialog
          entryId={entry._id}
          onOpenChange={closeDialog}
        />
      ) : null}
      {canRecordExit && openDialog === "exit" ? (
        <RecordExitDialog
          entryId={entry._id}
          organizationId={entry.organizationId}
          depositor={{
            name: entry.depositorName,
            accountId: entry.depositorAccountId,
          }}
          observedLocation={{
            id: entry.object?.currentLocationId ?? null,
            name: entry.object?.currentLocationName ?? null,
          }}
          onOpenChange={closeDialog}
        />
      ) : null}
      {canUpdate && openDialog === "edit" ? (
        <EditEntryDialog entry={entry} onOpenChange={closeDialog} />
      ) : null}
    </div>
  );
}
