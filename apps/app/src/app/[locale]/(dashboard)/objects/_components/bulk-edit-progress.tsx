"use client";

import { api } from "@v1/backend/convex/_generated/api";
import type { Id } from "@v1/backend/convex/_generated/dataModel";
import { Button } from "@v1/ui/button";
import { useMutation, useQuery } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import { useState } from "react";
import { ActionRefusal, type Refusal } from "@/components/action-refusal";
import { PermissionGate } from "@/components/permission-gate";
import { useBulkEditErrorMessage } from "@/hooks/use-bulk-edit-error-message";
import { useScopedI18n } from "@/locales/client";

type BulkEditView = NonNullable<
  FunctionReturnType<typeof api.bulkFieldEdits.get>
>;

/** What a bulk edit has done so far, with Stop while it runs and Resume after a failure. */
export function BulkEditStatus({ job }: { job: BulkEditView }) {
  const t = useScopedI18n("objects.bulkEdit");
  const errorMessage = useBulkEditErrorMessage();
  const cancel = useMutation(api.bulkFieldEdits.cancel);
  const resume = useMutation(api.bulkFieldEdits.resume);
  const [refusal, setRefusal] = useState<Refusal | null>(null);
  const counts = { checked: job.checked, changed: job.changed };

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
      {job.skipped > 0 ? (
        <p className="text-muted-foreground">
          {t("progressSkipped", { count: job.skipped })}
        </p>
      ) : null}
      <PermissionGate permission="collections.update">
        {job.status === "running" ? (
          <Button
            variant="outline"
            size="sm"
            onClick={() => act(() => cancel({ jobId: job._id }))}
          >
            {t("stop")}
          </Button>
        ) : job.status === "failed" ? (
          <Button
            variant="outline"
            size="sm"
            onClick={() => act(() => resume({ jobId: job._id }))}
          >
            {t("resume")}
          </Button>
        ) : null}
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
