"use client";

import { Button } from "@v1/ui/button";
import {
  AlertCircle,
  ArrowLeft,
  Ban,
  FileQuestion,
  History,
  Lock,
  RefreshCw,
} from "lucide-react";
import Link from "next/link";
import { useEffect } from "react";
import { useCapabilityErrorMessage } from "@/hooks/use-capability-error-message";
import { useBackToResults } from "@/hooks/use-return-path";
import {
  type RecordRecoveryKind,
  recordErrorKind,
} from "@/lib/record-recovery";
import { useScopedI18n } from "@/locales/client";

const RECORD_LISTS = {
  objects: "/objects",
  loans: "/loans",
  accessions: "/accessions",
  deaccessions: "/deaccessions",
  locations: "/locations",
  conservation: "/conservation",
} as const;

export type RecordList = keyof typeof RECORD_LISTS;

const KIND_ICONS = {
  missing: FileQuestion,
  removed: History,
  forbidden: Lock,
  unavailable: Ban,
  error: AlertCircle,
} as const;

/**
 * A detail page's back link: the originating results when the page was opened
 * from a list, otherwise the list itself.
 */
export function useBackToResultsLink(list: RecordList) {
  const t = useScopedI18n("recordRecovery");
  const back = useBackToResults(RECORD_LISTS[list]);
  return {
    href: back.href,
    fromResults: back.fromResults,
    label: back.fromResults ? t("backToResults") : t(`goToList.${list}`),
  };
}

interface RecordRecoveryStateProps {
  kind: RecordRecoveryKind;
  list: RecordList;
  onRetry?: () => void;
  errorId?: string;
  /** The guard's explanation of a refusal, replacing the generic copy. */
  reason?: string | null;
}

/**
 * Why a detail page cannot show its record, with the actions that recover:
 * back to the originating results, the list itself, or a retry for errors.
 */
export function RecordRecoveryState({
  kind,
  list,
  onRetry,
  errorId,
  reason,
}: RecordRecoveryStateProps) {
  const t = useScopedI18n("recordRecovery");
  const listHref = RECORD_LISTS[list];
  const back = useBackToResults(listHref);
  const Icon = KIND_ICONS[kind];
  const canRetry = kind === "error" && onRetry !== undefined;

  return (
    <div className="flex size-full items-center justify-center bg-background px-6 py-12">
      <section
        aria-labelledby="record-recovery-title"
        className="flex max-w-md flex-col items-center gap-5 rounded-lg border border-border bg-card p-8 text-center"
      >
        <div className="flex size-12 items-center justify-center rounded-full bg-muted">
          <Icon className="size-6 text-muted-foreground" aria-hidden="true" />
        </div>
        <div className="space-y-2">
          <h1
            id="record-recovery-title"
            className="text-lg font-semibold text-foreground"
          >
            {t(`${kind}.title`)}
          </h1>
          <p className="text-sm text-muted-foreground">
            {reason ?? t(`${kind}.description`)}
          </p>
        </div>
        {errorId ? (
          <p className="font-mono text-xs text-muted-foreground/70">
            {t("errorId", { id: errorId })}
          </p>
        ) : null}
        <div className="flex flex-wrap items-center justify-center gap-2">
          {canRetry ? (
            <Button onClick={onRetry}>
              <RefreshCw className="mr-2 size-4" aria-hidden="true" />
              {t("tryAgain")}
            </Button>
          ) : null}
          {back.fromResults ? (
            <Button asChild variant={canRetry ? "outline" : "default"}>
              <Link href={back.href}>
                <ArrowLeft className="mr-2 size-4" aria-hidden="true" />
                {t("backToResults")}
              </Link>
            </Button>
          ) : null}
          <Button
            asChild
            variant={canRetry || back.fromResults ? "outline" : "default"}
          >
            <Link href={listHref}>{t(`goToList.${list}`)}</Link>
          </Button>
        </div>
      </section>
    </div>
  );
}

interface RecordErrorRecoveryProps {
  error: Error & { digest?: string };
  list: RecordList;
  retry: () => void;
}

/** Error-boundary content for a detail route: classifies, then recovers. */
export function RecordErrorRecovery({
  error,
  list,
  retry,
}: RecordErrorRecoveryProps) {
  const kind = recordErrorKind(error);
  const reason = useCapabilityErrorMessage()(error);
  useEffect(() => {
    if (kind === "error") console.error("Record detail error:", error);
  }, [error, kind]);

  return (
    <RecordRecoveryState
      kind={kind}
      list={list}
      onRetry={retry}
      errorId={kind === "error" ? error.digest : undefined}
      reason={reason}
    />
  );
}

/** Shown for unknown routes and `notFound()` calls. */
export function PageNotFoundState() {
  const t = useScopedI18n("recordRecovery");

  return (
    <div className="flex size-full min-h-[50vh] items-center justify-center bg-background px-6 py-12">
      <section
        aria-labelledby="page-not-found-title"
        className="flex max-w-md flex-col items-center gap-5 rounded-lg border border-border bg-card p-8 text-center"
      >
        <div className="flex size-12 items-center justify-center rounded-full bg-muted">
          <FileQuestion
            className="size-6 text-muted-foreground"
            aria-hidden="true"
          />
        </div>
        <div className="space-y-2">
          <h1
            id="page-not-found-title"
            className="text-lg font-semibold text-foreground"
          >
            {t("pageNotFound.title")}
          </h1>
          <p className="text-sm text-muted-foreground">
            {t("pageNotFound.description")}
          </p>
        </div>
        <Button asChild>
          <Link href="/">{t("goToDashboard")}</Link>
        </Button>
      </section>
    </div>
  );
}
