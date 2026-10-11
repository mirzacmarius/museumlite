"use client";

import { api } from "@v1/backend/convex/_generated/api";
import type { Id } from "@v1/backend/convex/_generated/dataModel";
import { Badge } from "@v1/ui/badge";
import { useQuery } from "convex/react";
import Link from "next/link";
import { useScopedI18n } from "@/locales/client";

export function ExpectedList({
  sessionId,
}: {
  sessionId: Id<"inventorySessions">;
}) {
  const t = useScopedI18n("inventory.expected");
  const rows = useQuery(api.inventory.listExpected, { sessionId });

  if (rows === undefined)
    return <div className="h-24 animate-pulse rounded-xl bg-muted/60" />;
  if (rows.length === 0)
    return <p className="text-sm text-muted-foreground">{t("empty")}</p>;
  return (
    <ul className="divide-y divide-border rounded-xl border border-border">
      {rows.map((row) => (
        <li
          key={row._id}
          className="flex flex-wrap items-start justify-between gap-2 p-3"
        >
          <div className="min-w-0 flex-1">
            <Link
              href={`/objects/${row.collectionId}`}
              className="break-words font-mono text-sm underline-offset-2 hover:underline"
            >
              {row.accessionNumber}
            </Link>
            <p className="break-words text-sm">{row.title}</p>
            <p className="break-words text-xs text-muted-foreground">
              {row.observed && row.observedLocationName
                ? t("foundAt", { location: row.observedLocationName })
                : t("expectedIn", { location: row.expectedLocationName })}
            </p>
          </div>
          <Badge variant={row.observed ? "secondary" : "outline"}>
            {row.observed ? t("found") : t("notFound")}
          </Badge>
        </li>
      ))}
    </ul>
  );
}
