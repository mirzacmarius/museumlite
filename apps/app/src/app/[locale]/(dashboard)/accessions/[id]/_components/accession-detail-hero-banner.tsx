"use client";

import { Button } from "@v1/ui/button";
import {
  ArrowLeft,
  Calendar,
  Edit,
  ExternalLink,
  Info,
  Package,
} from "lucide-react";
import Link from "next/link";
import { ClientDate } from "@/components/client-date";
import { PermissionGate } from "@/components/permission-gate";
import { type FormatLocale, formatCurrency } from "@/lib/format-number";
import { useI18n } from "@/locales/client";
import { formatAccessionMethodLabel, StatusTile } from "./accession-detail-ui";
import type { AccessionDetailViewProps } from "./accession-detail-view-props";
export function AccessionDetailHeroBanner({
  accession,
  locale,
  isDraft,
  displayStatus,
  accessionTitle,
  accessionSubtitle,
  currentWorkflowStep,
  heroReviewStateLabel,
  reviewStateTone,
  heroSourceVerificationState,
  requiresSourceVerification,
  isSourceVerified,
  draftEditHref,
  getStatusIcon,
  getStatusColor,
}: AccessionDetailViewProps) {
  const tRoot = useI18n();
  return (
    <>
      <header className="sticky top-0 z-50 flex h-14 items-center justify-between border-b border-border/60 bg-background/80 px-6 backdrop-blur-xl">
        <div className="flex items-center gap-2 text-xs">
          <Button variant="ghost" size="icon" className="size-7" asChild>
            <Link href="/accessions">
              <ArrowLeft className="size-4 text-muted-foreground" />
            </Link>
          </Button>
          <span className="text-muted-foreground">
            {tRoot("accessions.title")}
          </span>
          <span className="text-muted-foreground/50">/</span>
          <span className="font-medium text-foreground">
            {accession.accessionNumber}
          </span>
        </div>

        <div className="flex items-center gap-3">
          {isDraft ? (
            <PermissionGate permission="collections.update">
              <Button variant="outline" size="sm" asChild>
                <Link href={draftEditHref}>
                  <Edit className="mr-2 size-4" />
                  {tRoot("untranslatedRecords.accessions.detail.editDraft")}
                </Link>
              </Button>
            </PermissionGate>
          ) : null}
          {accession.status === "pending" && !isDraft ? (
            <PermissionGate permission="collections.update">
              <Button variant="outline" size="sm" asChild>
                <Link href={draftEditHref}>
                  <Edit className="mr-2 size-4" />
                  {tRoot("accessions.detail.edit")}
                </Link>
              </Button>
            </PermissionGate>
          ) : null}
          {accession.collectionId ? (
            <Button variant="outline" size="sm" asChild>
              <Link href={`/objects/${accession.collectionId}`}>
                <ExternalLink className="mr-2 size-4" />
                {tRoot("accessions.detail.viewCollection")}
              </Link>
            </Button>
          ) : null}
        </div>
      </header>
      <div className="border-b border-border/60 bg-secondary/10 p-8">
        <div className="mx-auto flex max-w-5xl flex-col gap-8 lg:flex-row lg:items-start">
          <div className="flex size-48 shrink-0 flex-col items-center justify-center rounded-xl border border-border/60 bg-secondary text-center shadow-2xl">
            {getStatusIcon(displayStatus)}
            <div className="mt-4 space-y-1 px-6">
              <p className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
                {tRoot("untranslatedRecords.objects.detail.accession")}
              </p>
              <p className="text-sm font-medium text-foreground">
                {accession.accessionNumber}
              </p>
            </div>
          </div>

          <div className="flex-1 space-y-4">
            <div className="flex flex-wrap items-center gap-2.5">
              <span
                className={`rounded px-2 py-1 text-[10px] font-bold uppercase tracking-wider ${getStatusColor(
                  displayStatus,
                )}`}
              >
                {displayStatus === "draft"
                  ? tRoot("untranslatedRecords.accessions.detail.statusDraft")
                  : displayStatus === "pending"
                    ? tRoot("accessions.status.pending")
                    : displayStatus === "approved"
                      ? tRoot("accessions.status.approved")
                      : displayStatus === "rejected"
                        ? tRoot("accessions.status.rejected")
                        : displayStatus}
              </span>
              <div className="rounded bg-secondary/60 px-2 py-1 text-[10px] font-mono text-muted-foreground">
                {accession.accessionNumber}
              </div>
              {currentWorkflowStep ? (
                <div className="rounded bg-background/80 px-2 py-1 text-[10px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
                  {currentWorkflowStep.name}
                </div>
              ) : null}
            </div>

            <h1 className="text-2xl font-semibold tracking-tight text-foreground">
              {accessionTitle}
            </h1>

            <p className="max-w-3xl text-sm text-muted-foreground">
              {accessionSubtitle}
            </p>

            <div className="flex flex-wrap gap-x-6 gap-y-2 text-xs text-muted-foreground">
              <div className="flex items-center gap-2">
                <Calendar className="size-4" />
                <span>
                  {tRoot("library.acquisitions.stats.received")}{" "}
                  <ClientDate
                    timestamp={accession.dateReceived}
                    locale={locale}
                  />
                </span>
              </div>
              <div className="flex items-center gap-2">
                <Info className="size-4" />
                <span>{accession.source}</span>
              </div>
              <div className="flex items-center gap-2">
                <Package className="size-4" />
                <span>
                  {formatAccessionMethodLabel(accession.method, tRoot)}
                </span>
              </div>
            </div>

            <div className="grid gap-2 pt-1 sm:grid-cols-2 xl:grid-cols-4">
              <StatusTile
                label={tRoot(
                  "untranslatedRecords.accessions.detail.reviewState",
                )}
                value={heroReviewStateLabel}
                tone={reviewStateTone}
                compact
              />
              <StatusTile
                label={tRoot(
                  "untranslatedRecords.accessions.detail.currentStep",
                )}
                value={
                  currentWorkflowStep?.name ||
                  tRoot("untranslatedRecords.accessions.status.noActiveStep")
                }
                tone={currentWorkflowStep ? "warning" : "default"}
                compact
              />
              <StatusTile
                label={tRoot(
                  "untranslatedRecords.accessions.detail.sourceCheck",
                )}
                value={heroSourceVerificationState}
                tone={
                  requiresSourceVerification && !isSourceVerified
                    ? "warning"
                    : "success"
                }
                compact
              />
              <StatusTile
                label={tRoot("accessions.form.cost")}
                value={
                  accession.cost
                    ? formatCurrency(
                        accession.cost,
                        locale as FormatLocale,
                        "USD",
                      )
                    : tRoot("untranslatedRecords.accessions.status.notRecorded")
                }
                compact
              />
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
