"use client";

import { api } from "@v1/backend/convex/_generated/api";
import type { Id } from "@v1/backend/convex/_generated/dataModel";
import { BULK_EDIT_STALE_AFTER_MS } from "@v1/backend/convex/utils/bulkFieldEdits";
import { Button } from "@v1/ui/button";
import { useMutation, useQuery } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import { useEffect, useState } from "react";
import { ActionRefusal, type Refusal } from "@/components/action-refusal";
import { PermissionGate } from "@/components/permission-gate";
import { useBulkEditErrorMessage } from "@/hooks/use-bulk-edit-error-message";
import { formatNumber } from "@/lib/format-number";
import { useCurrentLocale, useScopedI18n } from "@/locales/client";

type BulkEditView = NonNullable<
  FunctionReturnType<typeof api.bulkFieldEdits.get>
>;

const STALE_CHECK_INTERVAL_MS = 30 * 1000;

/** Whether a running edit has stopped reporting long enough to be resumed. */
function useStalled(job: BulkEditView) {
  const [now, setNow] = useState(() => Date.now());
  const running = job.status === "running";
  useEffect(() => {
    if (!running) return;
    const timer = setInterval(
      () => setNow(Date.now()),
      STALE_CHECK_INTERVAL_MS,
    );
    return () => clearInterval(timer);
  }, [running]);
  return running && job.updatedAt < now - BULK_EDIT_STALE_AFTER_MS;
}

/**
 * What a bulk edit has done so far, with Stop while it runs or after a
 * failure (which also clears the catalog notice) and Resume after a failure
 * or once a running edit stops reporting.
 */
export function BulkEditStatus({ job }: { job: BulkEditView }) {
  const t = useScopedI18n("objects.bulkEdit");
  const errorMessage = useBulkEditErrorMessage("action");
  const stalled = useStalled(job);
  const cancel = useMutation(api.bulkFieldEdits.cancel);
  const resume = useMutation(api.bulkFieldEdits.resume);
  const [refusal, setRefusal] = useState<Refusal | null>(null);
  const locale = useCurrentLocale();
  const counts = {
    checked: formatNumber(job.checked, locale),
    changed: formatNumber(job.changed, locale),
  };

  const act = async (action: () => Promise<null>) => {
    setRefusal(null);
    try {
      await action();
    } catch (error) {
      setRefusal({ message: errorMessage(error) });
    }
  };

  return (
    <div className="space-y-2 text-sm" aria-live="polite">
      <p>
        {job.status === "running"
          ? t("progressRunning", {
              field: t(`fields.${job.edit.field}`),
              ...counts,
            })
          : job.status === "completed"
            ? t("progressCompleted", counts)
            : job.status === "failed"
              ? t("progressFailed", counts)
              : t("progressCancelled", counts)}
      </p>
      {stalled ? (
        <p className="text-muted-foreground">{t("progressStalled")}</p>
      ) : null}
      {job.skipped > 0 ? (
        <p className="text-muted-foreground">
          {t("progressSkipped", { count: formatNumber(job.skipped, locale) })}
        </p>
      ) : null}
      <PermissionGate permission="collections.update">
        <div className="flex gap-2">
          {job.status === "running" || job.status === "failed" ? (
            <Button
              variant="outline"
              size="sm"
              onClick={() => act(() => cancel({ jobId: job._id }))}
            >
              {t("stop")}
            </Button>
          ) : null}
          {job.status === "failed" || stalled ? (
            <Button
              variant="outline"
              size="sm"
              onClick={() => act(() => resume({ jobId: job._id }))}
            >
              {t("resume")}
            </Button>
          ) : null}
        </div>
      </PermissionGate>
      <ActionRefusal refusal={refusal} />
    </div>
  );
}

/** A started bulk edit's progress, inside the dialog that started it. */
export function BulkEditProgress({ jobId }: { jobId: Id<"bulkFieldEdits"> }) {
  const t = useScopedI18n("objects.bulkEdit");
  const job = useQuery(api.bulkFieldEdits.get, { jobId });
  if (!job) {
    return (
      <p className="py-2 text-sm text-muted-foreground">{t("starting")}</p>
    );
  }
  return (
    <div className="py-2">
      <BulkEditStatus job={job} />
    </div>
  );
}

/**
 * The catalog's notice for the Organization's latest bulk edit while it runs
 * or after it failed, so staff who closed the dialog still see it.
 */
export function BulkEditNotice({
  organizationId,
}: {
  organizationId: Id<"organizations">;
}) {
  const job = useQuery(api.bulkFieldEdits.latest, { organizationId });
  if (!job || (job.status !== "running" && job.status !== "failed")) {
    return null;
  }
  return (
    <div className="rounded-md border border-border bg-muted/40 px-4 py-3">
      <BulkEditStatus job={job} />
    </div>
  );
}
