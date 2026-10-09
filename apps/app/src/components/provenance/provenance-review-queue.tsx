"use client";

import { api } from "@v1/backend/convex/_generated/api";
import type { Id } from "@v1/backend/convex/_generated/dataModel";
import { Badge } from "@v1/ui/badge";
import { Button } from "@v1/ui/button";
import { usePaginatedQuery } from "convex/react";
import { ExternalLink } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { useScopedI18n } from "@/locales/client";
import { useHistoricalDateFormat } from "./use-historical-date-format";

const PAGE_SIZE = 20;
const STATUSES = ["unreviewed", "disputed"] as const;
type QueueStatus = (typeof STATUSES)[number];

/**
 * Current provenance claims waiting for a reviewer. Each opens the Object's
 * provenance, where the claim is reviewed beside the claims it contradicts.
 */
export function ProvenanceReviewQueue({
  organizationId,
}: {
  organizationId: Id<"organizations">;
}) {
  const t = useScopedI18n("provenance");
  const dates = useHistoricalDateFormat();
  const [status, setStatus] = useState<QueueStatus>("unreviewed");
  const {
    results,
    status: loadStatus,
    loadMore,
  } = usePaginatedQuery(
    api.provenance.reviewQueue,
    { organizationId, status },
    { initialNumItems: PAGE_SIZE },
  );

  return (
    <div className="space-y-3">
      <fieldset className="flex gap-2">
        <legend className="sr-only">{t("queue.title")}</legend>
        {STATUSES.map((option) => (
          <Button
            key={option}
            type="button"
            size="sm"
            variant={status === option ? "secondary" : "ghost"}
            aria-pressed={status === option}
            onClick={() => setStatus(option)}
          >
            {t(`queue.statuses.${option}`)}
          </Button>
        ))}
      </fieldset>
      {loadStatus === "LoadingFirstPage" ? (
        <p className="text-sm text-muted-foreground">{t("queue.loading")}</p>
      ) : results.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t("queue.empty")}</p>
      ) : (
        <ul className="divide-y divide-border rounded-lg border border-border">
          {results.map((item) => (
            <li key={item.claimId} className="space-y-1.5 px-4 py-3 text-sm">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <Link
                  href={`/objects/${item.objectId}?tab=provenance`}
                  className="inline-flex items-center gap-1 font-medium hover:underline"
                >
                  {item.objectLabel}
                  <ExternalLink className="size-3" />
                </Link>
                <div className="flex flex-wrap gap-1.5">
                  {item.role ? (
                    <Badge variant="outline">{t(`roles.${item.role}`)}</Badge>
                  ) : null}
                  <Badge variant="secondary">
                    {t(`confidence.${item.confidence}`)}
                  </Badge>
                </div>
              </div>
              <p className="font-mono text-xs text-muted-foreground">
                {dates.period(item.startDate, item.endDate)}
                {" · "}
                {item.partyKind === "named"
                  ? item.partyText
                  : t(`partyKinds.${item.partyKind}`)}
              </p>
              <p className="line-clamp-2 text-muted-foreground">
                {item.statement}
              </p>
              {item.contradictsClaimId ? (
                <p className="text-xs text-rose-700 dark:text-rose-300">
                  {t("queue.contradicts")}
                </p>
              ) : null}
              {item.reviewNote ? (
                <p className="text-xs text-muted-foreground">
                  {t("card.reviewNote", { note: item.reviewNote })}
                </p>
              ) : null}
            </li>
          ))}
        </ul>
      )}
      {loadStatus === "CanLoadMore" ? (
        <Button size="sm" variant="outline" onClick={() => loadMore(PAGE_SIZE)}>
          {t("queue.loadMore")}
        </Button>
      ) : null}
    </div>
  );
}
