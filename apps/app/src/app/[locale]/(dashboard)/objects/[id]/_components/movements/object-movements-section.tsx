"use client";

import { api } from "@v1/backend/convex/_generated/api";
import type { Id } from "@v1/backend/convex/_generated/dataModel";
import { Button } from "@v1/ui/button";
import { useQuery } from "convex/react";
import { ArrowRight, Truck } from "lucide-react";
import { useState } from "react";
import { usePermissions } from "@/components/permission-gate";
import { useCurrentLocale, useScopedI18n } from "@/locales/client";
import { DetailSection } from "../detail-section";
import {
  type MoveDialogMode,
  MoveObjectFormDialog,
} from "./move-object-form-dialog";
import { MoveRequestCard } from "./move-request-card";
import { formatMovementTime } from "./movement-labels";

const OPEN_STATUSES = new Set(["pending", "approved", "conflict"]);

interface ObjectMovementsSectionProps {
  collectionId: Id<"collections">;
  organizationId: Id<"organizations">;
  currentLocationId?: Id<"locations">;
  currentLocationLabel?: string;
}

export function ObjectMovementsSection({
  collectionId,
  organizationId,
  currentLocationId,
  currentLocationLabel,
}: ObjectMovementsSectionProps) {
  const t = useScopedI18n("locations.movements");
  const locale = useCurrentLocale();
  const { hasPermission } = usePermissions();
  const canManage = hasPermission("locations.update");
  const canReadRequests = hasPermission("locations.read");
  const [dialogMode, setDialogMode] = useState<MoveDialogMode | null>(null);

  const requests = useQuery(
    api.locations.listMoveRequests,
    canReadRequests ? { organizationId, collectionId } : "skip",
  );
  const history = useQuery(api.locations.getCollectionLocationHistory, {
    collectionId,
  });
  const hasOpenRequest =
    requests?.some((request) => OPEN_STATUSES.has(request.status)) ?? false;
  const sourceLabel = currentLocationLabel || t("noLocation");

  return (
    <DetailSection
      title={t("title")}
      icon={Truck}
      bodyClassName="space-y-6 border-0 bg-transparent p-0 sm:p-0"
      actions={
        canManage ? (
          <>
            <Button size="sm" onClick={() => setDialogMode("direct")}>
              {t("moveNow")}
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => setDialogMode("request")}
              disabled={hasOpenRequest || requests === undefined}
            >
              {t("requestMove")}
            </Button>
          </>
        ) : null
      }
    >
      {canReadRequests && (
        <section className="space-y-3 rounded-xl border border-border/60 bg-card p-4 sm:p-6">
          <h4 className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
            {t("requests.title")}
          </h4>
          {requests === undefined ? (
            <p className="text-sm text-muted-foreground" aria-live="polite">
              {t("loading")}
            </p>
          ) : requests.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              {t("requests.empty")}
            </p>
          ) : (
            <ul className="space-y-3">
              {requests.map((request) => (
                <MoveRequestCard
                  key={request._id}
                  request={request}
                  canManage={canManage}
                />
              ))}
            </ul>
          )}
        </section>
      )}

      <section className="space-y-3 rounded-xl border border-border/60 bg-card p-4 sm:p-6">
        <h4 className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
          {t("history.title")}
        </h4>
        {history === undefined ? (
          <p className="text-sm text-muted-foreground" aria-live="polite">
            {t("loading")}
          </p>
        ) : history.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t("history.empty")}</p>
        ) : (
          <ol className="space-y-3">
            {history.map((entry) => (
              <li
                key={entry._id}
                className="space-y-1 border-b border-border/60 pb-3 last:border-b-0 last:pb-0"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex min-w-0 flex-wrap items-center gap-2 text-sm">
                    <span className="break-words">
                      {entry.fromLocationName ??
                        (entry.fromLocationId
                          ? t("unknownLocation")
                          : t("noLocation"))}
                    </span>
                    <ArrowRight className="size-4 shrink-0 text-muted-foreground" />
                    <span className="break-words font-medium">
                      {entry.toLocationName || t("unknownLocation")}
                    </span>
                  </div>
                  <time className="text-right text-xs text-muted-foreground">
                    {formatMovementTime(locale, entry.movedAt)}
                  </time>
                </div>
                <p className="text-xs text-muted-foreground">
                  {t(`history.kind.${entry.movementKind ?? "legacy"}`)} ·{" "}
                  {t("history.movedBy", {
                    name: entry.movedByName ?? t("unknownUser"),
                  })}
                  {entry.authorizedBy &&
                    ` · ${t("history.authorizedBy", { name: entry.authorizedByName ?? t("unknownUser") })}`}
                </p>
                {entry.reason && (
                  <p className="break-words text-sm">{entry.reason}</p>
                )}
                {entry.notes && (
                  <p className="break-words text-xs text-muted-foreground">
                    {entry.notes}
                  </p>
                )}
              </li>
            ))}
          </ol>
        )}
      </section>

      {dialogMode && (
        <MoveObjectFormDialog
          mode={dialogMode}
          collectionId={collectionId}
          organizationId={organizationId}
          currentLocationId={currentLocationId}
          currentLocationLabel={sourceLabel}
          onClose={() => setDialogMode(null)}
        />
      )}
    </DetailSection>
  );
}
