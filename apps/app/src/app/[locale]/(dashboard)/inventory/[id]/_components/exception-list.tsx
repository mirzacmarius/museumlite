"use client";

import { api } from "@v1/backend/convex/_generated/api";
import { Badge } from "@v1/ui/badge";
import { useQuery } from "convex/react";
import Link from "next/link";
import { useScopedI18n } from "@/locales/client";
import { ExceptionSummary } from "../../_components/exception-summary";
import type { SessionView } from "./session-types";

export function ExceptionList({ session }: { session: SessionView }) {
  const t = useScopedI18n("inventory.exceptions");
  const finished =
    session.status === "reviewing" || session.status === "reconciled";
  const rows = useQuery(
    api.inventory.listExceptions,
    finished ? { sessionId: session._id } : "skip",
  );

  if (!finished)
    return <p className="text-sm text-muted-foreground">{t("notFinished")}</p>;
  if (rows === undefined)
    return <div className="h-24 animate-pulse rounded-xl bg-muted/60" />;
  if (rows.length === 0)
    return <p className="text-sm text-muted-foreground">{t("empty")}</p>;
  return (
    <ul className="divide-y divide-border rounded-xl border border-border">
      {rows.map((row) => (
        <li key={row._id}>
          <Link
            href={`/inventory/exceptions/${row._id}`}
            className="flex flex-wrap items-start justify-between gap-2 p-3 transition-colors hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <div className="min-w-0 flex-1 space-y-1">
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="outline">{t(`kinds.${row.kind}`)}</Badge>
                <span className="break-all font-mono text-sm">
                  {row.accessionNumber ?? row.scannedValue}
                </span>
              </div>
              {row.title ? (
                <p className="break-words text-sm">{row.title}</p>
              ) : null}
              <p className="break-words text-xs text-muted-foreground">
                <ExceptionSummary exception={row} />
              </p>
            </div>
            <Badge variant={row.status === "open" ? "default" : "secondary"}>
              {t(`statuses.${row.status}`)}
            </Badge>
          </Link>
        </li>
      ))}
    </ul>
  );
}
