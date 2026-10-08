"use client";

import { api } from "@v1/backend/convex/_generated/api";
import type { Id } from "@v1/backend/convex/_generated/dataModel";
import { Button } from "@v1/ui/button";
import { Input } from "@v1/ui/input";
import { Textarea } from "@v1/ui/textarea";
import { useMutation, useQuery } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import { useState } from "react";
import { useScopedI18n } from "@/locales/client";

type AuditEvent = FunctionReturnType<
  typeof api.auditLog.list
>["entries"][number];
function record(value: unknown): Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}
function display(value: unknown) {
  if (value === undefined) return "—";
  return typeof value === "string" ? value : JSON.stringify(value, null, 2);
}

export function AuditEventDetails({
  entry,
  organizationId,
  onCorrelate,
}: {
  entry: AuditEvent;
  organizationId: Id<"organizations">;
  onCorrelate: (filter: {
    entityType?: string;
    entityId?: string;
    objectId?: string;
    caseId?: string;
  }) => void;
}) {
  const t = useScopedI18n("activityLog");
  const canCorrect = useQuery(api.roles.checkPermission, {
    organizationId,
    permissionName: "organization.manage_settings",
  });
  const correct = useMutation(api.auditLog.correct);
  const [reason, setReason] = useState("");
  const [statement, setStatement] = useState("");
  const [requestId, setRequestId] = useState<string>();
  const [status, setStatus] = useState<"idle" | "saving" | "failed" | "saved">(
    "idle",
  );
  const changes = record(entry.changes);
  const before = record(changes.before ?? changes.oldValues);
  const after = record(changes.after ?? changes.newValues);
  const fields = Array.from(
    new Set([...Object.keys(before), ...Object.keys(after)]),
  );
  async function save() {
    const retryId = requestId ?? crypto.randomUUID();
    setRequestId(retryId);
    setStatus("saving");
    try {
      await correct({
        organizationId,
        eventId: entry._id,
        reason,
        statement,
        requestId: retryId,
      });
      setStatus("saved");
    } catch {
      setStatus("failed");
    }
  }
  return (
    <details className="mt-3 border-t border-border pt-3">
      <summary className="cursor-pointer text-sm">{t("details")}</summary>
      <div className="mt-3 space-y-3 text-sm">
        <p className="font-mono text-xs break-all">
          {entry._id} · {new Date(entry.timestamp).toISOString()}
        </p>
        <p>
          {entry.evidenceStatus === "legacy"
            ? t("legacyEvidence")
            : t("recordedEvidence")}
        </p>
        {entry.correctionOf && (
          <p>
            {t("correctionOf")}:{" "}
            <span className="font-mono">{entry.correctionOf}</span> ·{" "}
            {entry.correctionReason}
          </p>
        )}
        <div className="flex flex-wrap gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={() =>
              onCorrelate({
                entityType: entry.entityType,
                entityId: entry.entityId,
              })
            }
          >
            {t("subjectTimeline")}
          </Button>
          {entry.objectId && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => onCorrelate({ objectId: entry.objectId })}
            >
              {t("objectTimeline")}
            </Button>
          )}
          {entry.caseId && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => onCorrelate({ caseId: entry.caseId })}
            >
              {t("caseTimeline")}
            </Button>
          )}
        </div>
        {fields.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr>
                  <th>{t("field")}</th>
                  <th>{t("before")}</th>
                  <th>{t("after")}</th>
                </tr>
              </thead>
              <tbody>
                {fields.map((field) => (
                  <tr key={field} className="border-t border-border">
                    <th className="p-2 align-top">{field}</th>
                    <td className="p-2 whitespace-pre-wrap break-all align-top">
                      {display(before[field])}
                    </td>
                    <td className="p-2 whitespace-pre-wrap break-all align-top">
                      {display(after[field])}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <pre className="max-h-96 overflow-auto whitespace-pre-wrap break-all rounded bg-muted p-3 text-xs">
            {display(entry.changes) ?? "—"}
          </pre>
        )}
        {canCorrect && (
          <form
            className="space-y-2"
            onSubmit={(event) => {
              event.preventDefault();
              void save();
            }}
          >
            <Input
              aria-label={t("correctionReason")}
              placeholder={t("correctionReason")}
              required
              maxLength={2000}
              value={reason}
              onChange={(event) => {
                setReason(event.target.value);
                setRequestId(undefined);
                setStatus("idle");
              }}
            />
            <Textarea
              aria-label={t("correctionStatement")}
              placeholder={t("correctionStatement")}
              required
              maxLength={10000}
              value={statement}
              onChange={(event) => {
                setStatement(event.target.value);
                setRequestId(undefined);
                setStatus("idle");
              }}
            />
            <Button
              size="sm"
              disabled={
                status === "saving" ||
                status === "saved" ||
                !reason.trim() ||
                !statement.trim()
              }
            >
              {status === "saving" ? t("loading") : t("appendCorrection")}
            </Button>
            {status === "failed" && <p role="alert">{t("correctionFailed")}</p>}
            {status === "saved" && <p role="status">{t("correctionSaved")}</p>}
          </form>
        )}
      </div>
    </details>
  );
}
