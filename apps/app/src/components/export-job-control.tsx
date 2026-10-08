"use client";

import { useAuthToken } from "@convex-dev/auth/react";
import { api } from "@v1/backend/convex/_generated/api";
import type { Id } from "@v1/backend/convex/_generated/dataModel";
import { Button } from "@v1/ui/button";
import { useMutation, useQuery } from "convex/react";
import type { FunctionArgs, FunctionReturnType } from "convex/server";
import { useState } from "react";
import { env } from "@/env.mjs";
import { useFeatureAccess } from "@/hooks/use-feature-access";
import { formatIsoTimestamp } from "@/lib/format-date";
import { useScopedI18n } from "@/locales/client";

type ExportStatus = FunctionReturnType<typeof api.exports.status>["status"];
const CANCELLABLE_STATUSES = new Set<ExportStatus>([
  "selecting",
  "queued",
  "running",
  "finalizing",
]);
const RESUMABLE_STATUSES = new Set<ExportStatus>([
  "queued",
  "running",
  "finalizing",
  "failed",
  "cancelled",
]);

interface ExportJobControlProps {
  organizationId: Id<"organizations">;
  source: FunctionArgs<typeof api.exports.create>["source"];
  selectedIds?: Id<"collections">[];
  label: string;
}
export function ExportJobControl({
  organizationId,
  source,
  selectedIds,
  label,
}: ExportJobControlProps) {
  const t = useScopedI18n("exportJobs");
  const create = useMutation(api.exports.create);
  const append = useMutation(api.exports.appendSelection);
  const start = useMutation(api.exports.start);
  const cancel = useMutation(api.exports.cancel);
  const resume = useMutation(api.exports.resume);
  const { hasFeature } = useFeatureAccess();
  const sourceAllowed =
    source.kind !== "audit" || hasFeature("compliance", organizationId);
  const jobs = useQuery(
    api.exports.list,
    sourceAllowed ? { organizationId } : "skip",
  );
  const token = useAuthToken();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  const [format, setFormat] = useState<"csv" | "jsonl">("csv");
  const [selectionRequest, setSelectionRequest] = useState<{
    jobId: Id<"exportJobs">;
    ids: Id<"collections">[];
  }>();
  async function run(task: () => Promise<unknown>) {
    setBusy(true);
    setError(undefined);
    try {
      await task();
    } catch (e) {
      setError(e instanceof Error ? e.message : t("failed"));
    } finally {
      setBusy(false);
    }
  }
  async function captureSelection(request: {
    jobId: Id<"exportJobs">;
    ids: Id<"collections">[];
  }) {
    for (let offset = 0; offset < request.ids.length; offset += 100)
      await append({
        jobId: request.jobId,
        objectIds: request.ids.slice(offset, offset + 100),
      });
    await start({ jobId: request.jobId });
    setSelectionRequest(undefined);
  }
  async function request() {
    const jobId = await create({
      organizationId,
      source,
      format,
      selectedCount:
        source.kind === "objects" && source.mode === "selected"
          ? selectedIds?.length
          : undefined,
      requestKey: crypto.randomUUID(),
    });
    if (source.kind === "objects" && source.mode === "selected") {
      const pending = { jobId, ids: [...(selectedIds ?? [])] };
      setSelectionRequest(pending);
      await captureSelection(pending);
    }
  }
  async function download(
    jobId: Id<"exportJobs">,
    extension: string,
    manifest = false,
  ) {
    if (!token) throw new Error(t("signIn"));
    const siteUrl =
      env.NEXT_PUBLIC_CONVEX_SITE_URL ??
      env.NEXT_PUBLIC_CONVEX_URL.replace(/\.cloud$/, ".site");
    const response = await fetch(
      `${siteUrl}/exports/${manifest ? "manifest" : "download"}?jobId=${jobId}`,
      { headers: { Authorization: `Bearer ${token}` }, cache: "no-store" },
    );
    if (!response.ok) throw new Error(await response.text());
    const blob = await response.blob();
    if (!manifest) {
      const expected = response.headers.get("X-Content-SHA256");
      const digest = await crypto.subtle.digest(
        "SHA-256",
        await blob.arrayBuffer(),
      );
      const actual = Array.from(new Uint8Array(digest), (b) =>
        b.toString(16).padStart(2, "0"),
      ).join("");
      if (!expected || actual !== expected)
        throw new Error(t("checksumMismatch"));
    }
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `export-${jobId}.${extension}`;
    a.click();
    URL.revokeObjectURL(url);
  }
  function statusLabel(status: ExportStatus) {
    switch (status) {
      case "selecting":
        return t("statusSelecting");
      case "queued":
        return t("statusQueued");
      case "running":
        return t("statusRunning");
      case "finalizing":
        return t("statusFinalizing");
      case "completed":
        return t("statusCompleted");
      case "cancelled":
        return t("statusCancelled");
      case "failed":
        return t("statusFailed");
      case "expired":
        return t("statusExpired");
    }
  }
  if (!sourceAllowed) return null;
  return (
    <details className="border border-border rounded-md p-3 text-sm">
      <summary className="cursor-pointer">{label}</summary>
      <div className="flex flex-wrap gap-2 py-3">
        <select
          aria-label={t("format")}
          value={format}
          onChange={(e) =>
            setFormat(e.target.value === "jsonl" ? "jsonl" : "csv")
          }
          className="bg-background border rounded px-2"
        >
          <option value="csv">{t("formatCsv")}</option>
          <option value="jsonl">{t("formatJsonl")}</option>
        </select>
        <Button
          size="sm"
          disabled={
            busy ||
            (source.kind === "objects" &&
              source.mode === "selected" &&
              !selectedIds?.length)
          }
          onClick={() => void run(request)}
        >
          {t("create")}
        </Button>
        {selectionRequest && (
          <Button
            size="sm"
            disabled={busy}
            onClick={() => void run(() => captureSelection(selectionRequest))}
          >
            {t("retrySelection")}
          </Button>
        )}
      </div>
      <p className="text-xs text-muted-foreground">{t("policy")}</p>
      {error && (
        <p role="alert" className="text-destructive py-2">
          {error}
        </p>
      )}
      <ul className="space-y-3 mt-3">
        {jobs
          ?.filter((job) => job.source.kind === source.kind)
          .slice(0, 5)
          .map((job) => (
            <li key={job.jobId} className="border-t py-2">
              <p>
                {job.source.kind === "audit"
                  ? t("sourceAudit")
                  : job.source.mode === "selected"
                    ? t("sourceSelected")
                    : t("sourceCatalog")}{" "}
                · {job.format.toUpperCase()} · {statusLabel(job.status)} ·{" "}
                {t(job.source.kind === "audit" ? "progressAudit" : "progress", {
                  rows: job.rows,
                  scanned: job.scanned,
                  pages: job.checkpoint,
                })}
                {job.selected > 0
                  ? ` · ${t("selectedCount", { count: job.selected })}`
                  : ""}
              </p>
              <p className="text-xs text-muted-foreground">
                {t("cutoff", {
                  asOf: formatIsoTimestamp(job.asOf),
                  expiresAt: formatIsoTimestamp(job.expiresAt),
                })}
              </p>
              {job.error && <p role="alert">{job.error}</p>}
              <div className="flex gap-2 mt-2">
                {CANCELLABLE_STATUSES.has(job.status) && (
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={busy}
                    onClick={() => void run(() => cancel({ jobId: job.jobId }))}
                  >
                    Cancel
                  </Button>
                )}
                {RESUMABLE_STATUSES.has(job.status) && (
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={busy}
                    onClick={() => void run(() => resume({ jobId: job.jobId }))}
                  >
                    {job.status === "failed"
                      ? t("retry")
                      : job.status === "cancelled"
                        ? t("resume")
                        : t("recover")}
                  </Button>
                )}
                {job.status === "completed" && (
                  <>
                    <Button
                      size="sm"
                      disabled={busy}
                      onClick={() =>
                        void run(() => download(job.jobId, job.format))
                      }
                    >
                      {t("download", { count: job.rows })}
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={busy}
                      onClick={() =>
                        void run(() =>
                          download(job.jobId, "manifest.json", true),
                        )
                      }
                    >
                      {t("downloadManifest")}
                    </Button>
                  </>
                )}
              </div>
            </li>
          ))}
      </ul>
    </details>
  );
}
