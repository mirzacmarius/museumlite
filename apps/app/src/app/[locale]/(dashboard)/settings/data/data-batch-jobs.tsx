"use client";

import { api } from "@v1/backend/convex/_generated/api";
import type { Id } from "@v1/backend/convex/_generated/dataModel";
import { Button } from "@v1/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@v1/ui/card";
import { useMutation, useQuery } from "convex/react";
import { useState } from "react";
import { usePermissions } from "@/components/permission-gate";

function BatchJobDetails({ jobId }: { jobId: Id<"batchJobs"> }) {
  const job = useQuery(api.batchOperations.getBatchJobStatus, { jobId });
  const cancel = useMutation(api.batchOperations.cancelBatchJob);
  const { hasPermission } = usePermissions();
  const [error, setError] = useState<string | null>(null);
  const [isCancelling, setIsCancelling] = useState(false);
  if (job === undefined) return <p role="status">Loading job…</p>;
  if (!job) return <p role="status">This job is unavailable.</p>;
  const canCancel =
    (job.status === "pending" || job.status === "processing") &&
    hasPermission("collections.update");
  return (
    <div className="space-y-3 rounded-md border border-white/10 p-3 text-sm">
      <p role="status">
        {job.status}: {job.processedItems} of {job.totalItems} processed,{" "}
        {job.successCount} succeeded, {job.failureCount} failed.
      </p>
      {job.errors?.length ? (
        <>
          <p>
            Resolve these conflicts before submitting a new operation for the
            affected objects. The latest 100 failures are retained.
          </p>
          <ul className="space-y-1">
            {job.errors.map((item) => (
              <li key={item.itemId} className="break-all">
                {item.itemId}: {item.error}
              </li>
            ))}
          </ul>
        </>
      ) : null}
      {error ? (
        <p role="alert" className="text-destructive">
          {error}
        </p>
      ) : null}
      {canCancel ? (
        <Button
          variant="outline"
          disabled={isCancelling}
          onClick={async () => {
            setError(null);
            setIsCancelling(true);
            try {
              await cancel({ jobId });
            } catch (cause) {
              setError(
                cause instanceof Error ? cause.message : "Could not cancel job",
              );
            } finally {
              setIsCancelling(false);
            }
          }}
        >
          Cancel remaining items
        </Button>
      ) : null}
    </div>
  );
}

export function DataBatchJobs({
  organizationId,
}: {
  organizationId: Id<"organizations">;
}) {
  const { hasPermission } = usePermissions();
  const jobs = useQuery(
    api.batchOperations.listBatchJobs,
    hasPermission("collections.read") ? { organizationId, limit: 20 } : "skip",
  );
  const [selectedId, setSelectedId] = useState<Id<"batchJobs"> | null>(null);
  if (!jobs?.length) return null;
  return (
    <Card>
      <CardHeader>
        <CardTitle>Bulk operation history</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <ul className="space-y-2">
          {jobs.map((job) => (
            <li key={job._id}>
              <Button
                variant="outline"
                className="h-auto w-full justify-between gap-3 whitespace-normal py-3 text-left"
                onClick={() => setSelectedId(job._id)}
              >
                <span>{job.jobType.replaceAll("_", " ")}</span>
                <span>
                  {job.status} · {job.successCount} succeeded ·{" "}
                  {job.failureCount} failed
                </span>
              </Button>
            </li>
          ))}
        </ul>
        {selectedId ? (
          <BatchJobDetails key={selectedId} jobId={selectedId} />
        ) : null}
      </CardContent>
    </Card>
  );
}
