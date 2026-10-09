"use client";

import type { api } from "@v1/backend/convex/_generated/api";
import type { Id } from "@v1/backend/convex/_generated/dataModel";
import { Badge } from "@v1/ui/badge";
import { Button } from "@v1/ui/button";
import { cn } from "@v1/ui/utils";
import type { FunctionReturnType } from "convex/server";
import { ExternalLink, FileText, Quote } from "lucide-react";
import Link from "next/link";
import { ClientDate } from "@/components/client-date";
import { useCurrentLocale, useScopedI18n } from "@/locales/client";
import { useHistoricalDateFormat } from "./use-historical-date-format";

type ObjectProvenance = NonNullable<
  FunctionReturnType<typeof api.provenance.listForObject>
>;
export type ProvenanceClaimView = ObjectProvenance["claims"][number];
type EvidenceView = ProvenanceClaimView["evidence"][number];

export type ClaimAction =
  | { kind: "correct"; claim: ProvenanceClaimView }
  | { kind: "retract"; claimId: Id<"provenanceClaims"> }
  | { kind: "review"; claim: ProvenanceClaimView }
  | { kind: "identify"; claim: ProvenanceClaimView }
  | { kind: "unidentify"; linkId: Id<"partyLinks"> }
  | { kind: "addEvidence"; claimId: Id<"provenanceClaims"> }
  | { kind: "retractEvidence"; evidenceId: Id<"provenanceEvidence"> };

const REVIEW_STYLES: Record<ProvenanceClaimView["reviewStatus"], string> = {
  unreviewed:
    "border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300",
  accepted:
    "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
  disputed:
    "border-rose-500/30 bg-rose-500/10 text-rose-700 dark:text-rose-300",
  rejected: "border-border bg-muted text-muted-foreground",
};

function EvidenceItem({
  evidence,
  canRetract,
  onAction,
}: {
  evidence: EvidenceView;
  canRetract: boolean;
  onAction: (action: ClaimAction) => void;
}) {
  const t = useScopedI18n("provenance.evidence");
  let source: React.ReactNode;
  if (evidence.kind === "citation") {
    source = (
      <span className="whitespace-pre-wrap">
        {evidence.citation}
        {evidence.url ? (
          <a
            href={evidence.url}
            target="_blank"
            rel="noopener noreferrer"
            className="ml-2 inline-flex items-center gap-1 text-xs underline-offset-4 hover:underline"
          >
            {t("open")}
            <ExternalLink className="size-3" />
          </a>
        ) : null}
      </span>
    );
  } else if (evidence.restricted) {
    source = (
      <span className="text-muted-foreground">{t("restrictedFile")}</span>
    );
  } else {
    source = (
      <span className="inline-flex items-center gap-1.5">
        <FileText className="size-3.5 text-muted-foreground" />
        {evidence.fileName}
        {evidence.url ? (
          <a
            href={evidence.url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-xs underline-offset-4 hover:underline"
          >
            {t("open")}
            <ExternalLink className="size-3" />
          </a>
        ) : (
          <span className="text-xs text-muted-foreground">
            {t("fileUnavailable")}
          </span>
        )}
      </span>
    );
  }
  return (
    <li className="space-y-1 text-sm">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div
          className={cn(
            "min-w-0",
            !evidence.isActive && "text-muted-foreground line-through",
          )}
        >
          {source}
          {evidence.locator ? (
            <span className="ml-1 text-xs text-muted-foreground">
              {t("locatorLabel", { locator: evidence.locator })}
            </span>
          ) : null}
        </div>
        {canRetract && evidence.isActive ? (
          <Button
            type="button"
            size="sm"
            variant="ghost"
            className="h-7 px-2 text-xs"
            onClick={() =>
              onAction({ kind: "retractEvidence", evidenceId: evidence._id })
            }
          >
            {t("retract")}
          </Button>
        ) : null}
      </div>
      {evidence.excerpt ? (
        <p
          className={cn(
            "text-xs italic text-muted-foreground",
            !evidence.isActive && "line-through",
          )}
        >
          {t("quote", { excerpt: evidence.excerpt })}
        </p>
      ) : null}
      {!evidence.isActive && evidence.retractionReason ? (
        <p className="text-xs text-muted-foreground">
          {t("retracted", { reason: evidence.retractionReason })}
        </p>
      ) : null}
    </li>
  );
}

function Holder({ claim }: { claim: ProvenanceClaimView }) {
  const t = useScopedI18n("provenance");
  if (claim.partyKind === "named") {
    return (
      <span className="font-semibold text-foreground">{claim.partyText}</span>
    );
  }
  return (
    <span className="font-semibold text-foreground">
      {t(`partyKinds.${claim.partyKind}`)}
      {claim.partyText ? (
        <span className="font-normal text-muted-foreground">
          {" "}
          ({claim.partyText})
        </span>
      ) : null}
    </span>
  );
}

interface ProvenanceClaimCardProps {
  claim: ProvenanceClaimView;
  /** Statements of the Object's claims by ID, for contradiction notes. */
  statements: Map<Id<"provenanceClaims">, string>;
  canRecord: boolean;
  canReview: boolean;
  canLinkParties: boolean;
  onAction: (action: ClaimAction) => void;
}

/** One claim as recorded, with its review, contradictions and evidence. */
export function ProvenanceClaimCard({
  claim,
  statements,
  canRecord,
  canReview,
  canLinkParties,
  onAction,
}: ProvenanceClaimCardProps) {
  const t = useScopedI18n("provenance");
  const locale = useCurrentLocale();
  const dates = useHistoricalDateFormat();
  const current = claim.isCurrent;
  const party = claim.party;
  const contradicts = claim.contradictsClaimId
    ? statements.get(claim.contradictsClaimId)
    : undefined;

  return (
    <li className="space-y-3 rounded-lg border border-border/60 bg-card p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0 space-y-1">
          <p className="font-mono text-xs text-muted-foreground">
            {dates.period(claim.startDate, claim.endDate)}
          </p>
          <p className="text-sm">
            <Holder claim={claim} />
          </p>
          {party ? (
            <p className="text-xs text-muted-foreground">
              <Link
                href={`/accounts/${party.accountId}`}
                className="underline-offset-4 hover:underline"
              >
                {t("card.identifiedAs", {
                  name: party.partyName ?? party.nameSnapshot,
                })}
              </Link>
              {party.partyArchived ? ` · ${t("card.partyArchived")}` : ""}
            </p>
          ) : null}
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          <Badge variant="outline">{t(`roles.${claim.role}`)}</Badge>
          <Badge variant="secondary">
            {t(`confidence.${claim.confidence}`)}
          </Badge>
          {current ? (
            <span
              className={cn(
                "rounded-full border px-2 py-0.5 text-[11px] font-medium",
                REVIEW_STYLES[claim.reviewStatus],
              )}
            >
              {t(`reviewStatus.${claim.reviewStatus}`)}
            </span>
          ) : (
            <Badge variant="outline">
              {claim.supersededByClaimId
                ? t("card.corrected")
                : t("card.retracted")}
            </Badge>
          )}
        </div>
      </div>

      {claim.method || claim.place ? (
        <p className="text-xs text-muted-foreground">
          {[
            claim.method
              ? t("card.method", { method: t(`methods.${claim.method}`) })
              : null,
            claim.place ? t("card.place", { place: claim.place }) : null,
          ]
            .filter(Boolean)
            .join(" · ")}
        </p>
      ) : null}

      <blockquote className="flex gap-2 rounded-md bg-muted/40 px-3 py-2 text-sm">
        <Quote className="mt-0.5 size-3.5 shrink-0 text-muted-foreground" />
        <span>
          <span className="sr-only">{t("card.statement")}: </span>
          <span className="whitespace-pre-wrap">{claim.statement}</span>
        </span>
      </blockquote>

      {contradicts || claim.contradictedByClaimIds.length > 0 ? (
        <ul className="space-y-1 text-xs text-rose-700 dark:text-rose-300">
          {contradicts ? (
            <li>{t("card.contradicts", { statement: contradicts })}</li>
          ) : null}
          {claim.contradictedByClaimIds.map((id) => (
            <li key={id}>
              {t("card.contradictedBy", {
                statement: statements.get(id) ?? "",
              })}
            </li>
          ))}
        </ul>
      ) : null}

      <div className="space-y-1.5">
        <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
          {t("evidence.title")}
        </p>
        {claim.evidence.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t("evidence.none")}</p>
        ) : (
          <ul className="space-y-2">
            {claim.evidence.map((evidence) => (
              <EvidenceItem
                key={evidence._id}
                evidence={evidence}
                canRetract={canRecord && current}
                onAction={onAction}
              />
            ))}
          </ul>
        )}
      </div>

      <div className="space-y-0.5 text-xs text-muted-foreground">
        {claim.supersedesClaimId ? <p>{t("card.corrects")}</p> : null}
        <p>
          {t("card.recordedBy", {
            name: claim.createdByName ?? t("card.someone"),
          })}
          {" · "}
          <ClientDate timestamp={claim.createdAt} locale={locale} />
        </p>
        {claim.reviewedAt ? (
          <p>
            {t("card.reviewedBy", {
              name: claim.reviewedByName ?? t("card.someone"),
            })}
            {" · "}
            <ClientDate timestamp={claim.reviewedAt} locale={locale} />
          </p>
        ) : null}
        {claim.reviewNote ? (
          <p>{t("card.reviewNote", { note: claim.reviewNote })}</p>
        ) : null}
        {claim.supersessionReason ? (
          <p>{t("card.reason", { reason: claim.supersessionReason })}</p>
        ) : null}
      </div>

      {current && (canRecord || canReview || canLinkParties) ? (
        <div className="flex flex-wrap gap-2 border-t border-border/60 pt-3">
          {canReview ? (
            <Button
              type="button"
              size="sm"
              onClick={() => onAction({ kind: "review", claim })}
            >
              {t("card.review")}
            </Button>
          ) : null}
          {canRecord ? (
            <>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => onAction({ kind: "correct", claim })}
              >
                {t("card.correct")}
              </Button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() =>
                  onAction({ kind: "addEvidence", claimId: claim._id })
                }
              >
                {t("card.addEvidence")}
              </Button>
            </>
          ) : null}
          {canLinkParties && claim.partyKind === "named" ? (
            party ? (
              <Button
                type="button"
                size="sm"
                variant="ghost"
                onClick={() =>
                  onAction({ kind: "unidentify", linkId: party.linkId })
                }
              >
                {t("identify.remove")}
              </Button>
            ) : (
              <Button
                type="button"
                size="sm"
                variant="ghost"
                onClick={() => onAction({ kind: "identify", claim })}
              >
                {t("identify.title")}
              </Button>
            )
          ) : null}
          {canRecord ? (
            <Button
              type="button"
              size="sm"
              variant="ghost"
              className="text-destructive"
              onClick={() => onAction({ kind: "retract", claimId: claim._id })}
            >
              {t("card.retract")}
            </Button>
          ) : null}
        </div>
      ) : null}
    </li>
  );
}
