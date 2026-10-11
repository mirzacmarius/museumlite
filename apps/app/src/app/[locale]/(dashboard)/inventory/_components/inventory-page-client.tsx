"use client";

import { api } from "@v1/backend/convex/_generated/api";
import type { Id } from "@v1/backend/convex/_generated/dataModel";
import { Button } from "@v1/ui/button";
import { Progress } from "@v1/ui/progress";
import { useQuery } from "convex/react";
import { ClipboardList, Plus } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { usePermissions } from "@/components/permission-gate";
import { useCurrentLocale, useScopedI18n } from "@/locales/client";
import { formatMoment } from "./inventory-format";
import { SessionStatusBadge } from "./session-status-badge";
import { StartSessionDialog } from "./start-session-dialog";

export function InventoryPageClient({
  organizationId,
}: {
  organizationId: Id<"organizations">;
}) {
  const t = useScopedI18n("inventory");
  const locale = useCurrentLocale();
  const { hasPermission } = usePermissions();
  const canWork = hasPermission("locations.update");
  const sessions = useQuery(api.inventory.listSessions, { organizationId });
  const [starting, setStarting] = useState(false);

  return (
    <div className="flex size-full flex-col overflow-y-auto bg-background">
      <div className="mx-auto w-full max-w-5xl space-y-6 p-4 sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex max-w-3xl flex-col gap-2">
            <h1 className="page-title">{t("title")}</h1>
            <p className="page-description">{t("description")}</p>
          </div>
          {canWork ? (
            <Button onClick={() => setStarting(true)}>
              <Plus className="mr-2 size-4" />
              {t("newSession")}
            </Button>
          ) : null}
        </div>
        {!canWork ? (
          <p className="rounded-md border border-border p-3 text-sm text-muted-foreground">
            {t("workUnavailable")}
          </p>
        ) : null}

        <section
          aria-labelledby="inventory-sessions-title"
          className="space-y-3"
        >
          <h2 id="inventory-sessions-title" className="text-lg font-medium">
            {t("sessionsTitle")}
          </h2>
          {sessions === undefined ? (
            <div className="space-y-2" aria-busy="true">
              {[0, 1, 2].map((index) => (
                <div
                  key={index}
                  className="h-20 animate-pulse rounded-xl bg-muted/60"
                />
              ))}
            </div>
          ) : sessions.length === 0 ? (
            <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed border-border p-8 text-center">
              <ClipboardList className="size-6 text-muted-foreground" />
              <p className="text-sm font-medium">{t("noSessions")}</p>
              <p className="text-sm text-muted-foreground">
                {t("noSessionsHint")}
              </p>
            </div>
          ) : (
            <ul className="space-y-2">
              {sessions.map((session) => {
                const scope = session.scopeLocationName ?? "";
                return (
                  <li key={session._id}>
                    <Link
                      href={`/inventory/${session._id}`}
                      className="block rounded-xl border border-border bg-card p-4 transition-colors hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <span className="break-words font-medium">
                          {session.name}
                        </span>
                        <SessionStatusBadge status={session.status} />
                      </div>
                      <p className="mt-1 break-words text-sm text-muted-foreground">
                        {session.includeSublocations
                          ? t("withSublocations", { location: scope })
                          : scope}
                      </p>
                      <div className="mt-3 space-y-1">
                        <Progress
                          value={session.progress.observed}
                          max={Math.max(session.progress.expected, 1)}
                          aria-label={t("progress", {
                            observed: session.progress.observed,
                            expected: session.progress.expected,
                          })}
                        />
                        <div className="flex flex-wrap justify-between gap-x-4 gap-y-1 text-xs text-muted-foreground">
                          <span>
                            {t("progress", {
                              observed: session.progress.observed,
                              expected: session.progress.expected,
                            })}
                          </span>
                          {session.openExceptionCount > 0 ? (
                            <span>
                              {t("session.exceptionsOpen", {
                                count: session.openExceptionCount,
                              })}
                            </span>
                          ) : null}
                          <span>{formatMoment(session.startedAt, locale)}</span>
                        </div>
                      </div>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      </div>
      {starting ? (
        <StartSessionDialog
          organizationId={organizationId}
          onOpenChange={(open) => {
            if (!open) setStarting(false);
          }}
        />
      ) : null}
    </div>
  );
}
