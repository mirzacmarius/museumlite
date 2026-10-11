"use client";

import { api } from "@v1/backend/convex/_generated/api";
import type { Id } from "@v1/backend/convex/_generated/dataModel";
import { Badge } from "@v1/ui/badge";
import { useQuery } from "convex/react";
import Link from "next/link";
import { useCurrentLocale, useScopedI18n } from "@/locales/client";
import { formatMoment } from "../../_components/inventory-format";
import { ObservationOutcome } from "./observation-outcome";

const LISTED = 200;

export function ObservationList({
  sessionId,
}: {
  sessionId: Id<"inventorySessions">;
}) {
  const t = useScopedI18n("inventory.observations");
  const tSession = useScopedI18n("inventory.session");
  const locale = useCurrentLocale();
  const rows = useQuery(api.inventory.listObservations, { sessionId });

  if (rows === undefined)
    return <div className="h-24 animate-pulse rounded-xl bg-muted/60" />;
  if (rows.length === 0)
    return <p className="text-sm text-muted-foreground">{t("empty")}</p>;
  return (
    <div className="space-y-2">
      {rows.length >= LISTED ? (
        <p className="text-xs text-muted-foreground">{t("latestOnly")}</p>
      ) : null}
      <ul className="divide-y divide-border rounded-xl border border-border">
        {rows.map((row) => (
          <li key={row._id} className="space-y-1 p-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              {row.collectionId ? (
                <Link
                  href={`/objects/${row.collectionId}`}
                  className="break-all font-mono text-sm underline-offset-2 hover:underline"
                >
                  {row.accessionNumber}
                </Link>
              ) : (
                <span className="break-all font-mono text-sm">
                  {row.scannedValue}
                </span>
              )}
              <Badge variant="outline">{t(`methods.${row.method}`)}</Badge>
            </div>
            {row.title ? (
              <p className="break-words text-sm">{row.title}</p>
            ) : null}
            <ObservationOutcome
              outcome={row.outcome}
              observedLocationName={row.observedLocationName}
              recordedLocationName={row.recordedLocationName}
            />
            {row.note ? (
              <p className="whitespace-pre-wrap break-words text-sm">
                {row.note}
              </p>
            ) : null}
            <p className="text-xs text-muted-foreground">
              {t("by", {
                name: row.observedByName ?? tSession("unknownPerson"),
                date: formatMoment(row.observedAt, locale),
              })}
            </p>
          </li>
        ))}
      </ul>
    </div>
  );
}
