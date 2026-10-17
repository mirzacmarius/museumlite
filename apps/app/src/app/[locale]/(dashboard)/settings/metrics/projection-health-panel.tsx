"use client";

import { api } from "@v1/backend/convex/_generated/api";
import type { Id } from "@v1/backend/convex/_generated/dataModel";
import { Badge } from "@v1/ui/badge";
import { Button } from "@v1/ui/button";
import { useMutation, useQuery } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import { ConvexError } from "convex/values";
import { useState } from "react";
import { unavailableReasonLabel } from "@/components/metrics-unavailable-notice";
import { useClientRelativeTime } from "@/hooks/use-client-date-format";
import { useCurrentLocale, useScopedI18n } from "@/locales/client";
import { ProjectionDiscrepancies } from "./projection-discrepancies";

type Health = FunctionReturnType<typeof api.projections.getHealth>;
type Generation = NonNullable<Health["active"]>;
type Translate = ReturnType<typeof useScopedI18n<"projectionHealth">>;

function RelativeTime({ timestamp }: { timestamp: number | undefined }) {
  const locale = useCurrentLocale();
  const value = useClientRelativeTime(timestamp, locale, { addSuffix: true });
  return <span className="text-white/60">{timestamp ? value : "—"}</span>;
}

function statusLabel(status: Generation["status"], t: Translate) {
  switch (status) {
    case "building":
      return t("status.building");
    case "failed":
      return t("status.failed");
    case "cancelled":
      return t("status.cancelled");
    case "completed":
      return t("status.completed");
    case "superseded":
      return t("status.superseded");
  }
}

function modeLabel(mode: Generation["mode"], t: Translate) {
  return mode === "rebuild" ? t("mode.rebuild") : t("mode.reconcile");
}

function errorMessage(error: unknown, fallback: string) {
  return error instanceof ConvexError && typeof error.data === "string"
    ? error.data
    : fallback;
}

function useJobAction(organizationId: Id<"organizations">) {
  const t = useScopedI18n("projectionHealth");
  const [pending, setPending] = useState<string>();
  const [error, setError] = useState<string>();
  async function run(key: string, task: () => Promise<unknown>) {
    setPending(key);
    setError(undefined);
    try {
      await task();
    } catch (cause) {
      setError(errorMessage(cause, t("actions.failed")));
    } finally {
      setPending(undefined);
    }
  }
  return { organizationId, pending, error, run };
}

type JobAction = ReturnType<typeof useJobAction>;

function Row({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-4 py-1.5 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className="text-right text-foreground">{children}</span>
    </div>
  );
}

function StatusCard({ health, action }: { health: Health; action: JobAction }) {
  const t = useScopedI18n("projectionHealth");
  const ready = health.availability === "ready";
  return (
    <section className="rounded-lg border border-white/10 bg-card p-4">
      <div className="flex items-center gap-2">
        <h3 className="text-base font-medium">{t("page.statusTitle")}</h3>
        <Badge variant={ready ? "default" : "destructive"}>
          {ready
            ? health.updating
              ? t("availability.updating")
              : t("availability.ready")
            : t("availability.unavailable")}
        </Badge>
      </div>
      {!ready && health.reason ? (
        <p className="mt-2 text-sm text-muted-foreground">
          {unavailableReasonLabel(health.reason, t)}
        </p>
      ) : null}
      <p className="mt-1 text-xs text-muted-foreground">
        {t("page.automatic")}
      </p>
      <div className="mt-3 divide-y divide-white/10">
        <Row label={t("page.definitionVersion")}>
          {health.stateDefinitionVersion === null ||
          health.stateDefinitionVersion === health.definitionVersion
            ? health.definitionVersion
            : t("page.definitionOutdated", {
                stored: health.stateDefinitionVersion,
                current: health.definitionVersion,
              })}
        </Row>
        <Row label={t("page.lastBuilt")}>
          <RelativeTime timestamp={health.lastBuiltAt} />
        </Row>
        <Row label={t("page.lastVerified")}>
          <RelativeTime timestamp={health.lastVerifiedAt} />
        </Row>
        {health.nextReconcileAt ? (
          <Row label={t("page.nextReconcile")}>
            <RelativeTime timestamp={health.nextReconcileAt} />
          </Row>
        ) : null}
        {health.invalidatedAt ? (
          <Row label={t("page.invalidated")}>
            <RelativeTime timestamp={health.invalidatedAt} />
          </Row>
        ) : null}
        <Row label={t("page.limits")}>
          {t("page.limitsValue", {
            pageSize: health.limits.pageSize,
            fanOut: health.limits.fanOutLimit,
          })}
        </Row>
      </div>
      {action.error ? (
        <p role="alert" className="mt-3 text-sm text-destructive">
          {action.error}
        </p>
      ) : null}
    </section>
  );
}

function JobCard({
  generation,
  action,
}: {
  generation: Generation;
  action: JobAction;
}) {
  const t = useScopedI18n("projectionHealth");
  const retry = useMutation(api.projections.retryRebuild);
  const cancel = useMutation(api.projections.cancelRebuild);
  const args = {
    organizationId: action.organizationId,
    generationId: generation._id,
  };
  const busy = action.pending !== undefined;
  return (
    <section className="rounded-lg border border-white/10 bg-card p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <h3 className="text-base font-medium">
            {modeLabel(generation.mode, t)}
          </h3>
          <Badge
            variant={generation.status === "failed" ? "destructive" : "outline"}
          >
            {statusLabel(generation.status, t)}
          </Badge>
        </div>
        <div className="flex gap-2">
          {generation.status === "failed" ? (
            <Button
              size="sm"
              disabled={busy}
              onClick={() =>
                action.run(`retry-${generation._id}`, () => retry(args))
              }
            >
              {action.pending === `retry-${generation._id}`
                ? t("actions.retrying")
                : t("actions.retry")}
            </Button>
          ) : null}
          <Button
            size="sm"
            variant="outline"
            disabled={busy}
            onClick={() =>
              action.run(`cancel-${generation._id}`, () => cancel(args))
            }
          >
            {action.pending === `cancel-${generation._id}`
              ? t("actions.cancelling")
              : t("actions.cancel")}
          </Button>
        </div>
      </div>
      <div className="mt-3 divide-y divide-white/10">
        <Row label={t("job.step")}>
          {t("job.stepValue", {
            index: Math.min(generation.stepIndex + 1, generation.stepCount),
            count: generation.stepCount,
          })}{" "}
          <span className="font-mono text-xs text-muted-foreground">
            {generation.step}
          </span>
        </Row>
        <Row label={t("job.processedRows")}>{generation.processedRows}</Row>
        <Row label={t("job.checkpoint")}>{generation.checkpoint}</Row>
        <Row label={t("job.attempts")}>{generation.attempts}</Row>
        <Row label={t("job.started")}>
          <RelativeTime timestamp={generation.startedAt} />
        </Row>
        {generation.requestedByName ? (
          <Row label={t("job.requestedBy")}>{generation.requestedByName}</Row>
        ) : null}
      </div>
      {generation.failure ? (
        <p role="alert" className="mt-3 text-sm text-destructive">
          {t("job.failure", { message: generation.failure })}
        </p>
      ) : null}
    </section>
  );
}

function ReconciliationCard({
  generation,
  organizationId,
}: {
  generation: Generation;
  organizationId: Id<"organizations">;
}) {
  const t = useScopedI18n("projectionHealth");
  const completed = generation.status === "completed";
  return (
    <section className="rounded-lg border border-white/10 bg-card p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h3 className="text-base font-medium">{t("reconciliation.title")}</h3>
        <RelativeTime timestamp={generation.finishedAt} />
      </div>
      <p className="mt-2 text-sm text-muted-foreground">
        {!completed
          ? t("reconciliation.incomplete", {
              status: statusLabel(generation.status, t),
            })
          : generation.discrepancyCount === 0
            ? t("reconciliation.clean")
            : t("reconciliation.summary", {
                discrepancies: generation.discrepancyCount,
                mismatches: generation.mismatchCount,
              })}
      </p>
      <p className="mt-1 text-xs text-muted-foreground">
        {t("reconciliation.noRepair")}
      </p>
      {completed && generation.discrepancyCount > 0 ? (
        <ProjectionDiscrepancies
          organizationId={organizationId}
          generationId={generation._id}
        />
      ) : null}
    </section>
  );
}

function SourceQualityCard({ health }: { health: Health }) {
  const t = useScopedI18n("projectionHealth");
  if (health.sourceQuality.length === 0) return null;
  return (
    <section className="rounded-lg border border-white/10 bg-card p-4">
      <h3 className="text-base font-medium">{t("quality.title")}</h3>
      <p className="mt-1 text-xs text-muted-foreground">
        {t("quality.description")}
      </p>
      <div className="mt-3 divide-y divide-white/10">
        {health.sourceQuality.map((entry) => (
          <Row key={entry.metric} label={entry.metric}>
            {entry.count}
          </Row>
        ))}
      </div>
    </section>
  );
}

function RecentJobs({ health }: { health: Health }) {
  const t = useScopedI18n("projectionHealth");
  if (health.recentGenerations.length === 0) return null;
  return (
    <section className="rounded-lg border border-white/10 bg-card p-4">
      <h3 className="text-base font-medium">{t("recent.title")}</h3>
      <ul className="mt-3 divide-y divide-white/10">
        {health.recentGenerations.map((generation) => (
          <li
            key={generation._id}
            className="flex flex-wrap items-center justify-between gap-2 py-2 text-sm"
          >
            <span>
              {modeLabel(generation.mode, t)} ·{" "}
              {statusLabel(generation.status, t)}
            </span>
            <span className="text-xs text-muted-foreground">
              {t("recent.rows", { rows: generation.processedRows })}
              {generation.mode === "reconcile" &&
              generation.status === "completed"
                ? ` · ${t("recent.discrepancies", { count: generation.discrepancyCount })}`
                : ""}
            </span>
            <RelativeTime
              timestamp={generation.finishedAt ?? generation.startedAt}
            />
          </li>
        ))}
      </ul>
    </section>
  );
}

export function ProjectionHealthPanel({
  organizationId,
}: {
  organizationId: Id<"organizations">;
}) {
  const health = useQuery(api.projections.getHealth, { organizationId });
  const action = useJobAction(organizationId);
  if (health === undefined) {
    return <div className="h-40 rounded-lg border border-border bg-card" />;
  }
  return (
    <div className="flex flex-col gap-4">
      <StatusCard health={health} action={action} />
      {health.building ? (
        <JobCard generation={health.building} action={action} />
      ) : null}
      {health.reconciling ? (
        <JobCard generation={health.reconciling} action={action} />
      ) : null}
      {health.lastReconciliation ? (
        <ReconciliationCard
          generation={health.lastReconciliation}
          organizationId={organizationId}
        />
      ) : null}
      <SourceQualityCard health={health} />
      <RecentJobs health={health} />
    </div>
  );
}
