"use client";

import { api } from "@v1/backend/convex/_generated/api";
import type { Id } from "@v1/backend/convex/_generated/dataModel";
import {
  BULK_EDIT_FIELDS,
  type BulkEditField,
} from "@v1/backend/convex/utils/bulkFieldEdits";
import { storedListValues } from "@v1/backend/convex/utils/objectSearchDocuments";
import { Avatar, AvatarFallback, AvatarImage } from "@v1/ui/avatar";
import { Button } from "@v1/ui/button";
import { useQuery } from "convex/react";
import { ScrollText } from "lucide-react";
import { useState } from "react";
import { ClientDate } from "@/components/client-date";
import { useI18n, useScopedI18n } from "@/locales/client";
import { DetailSection } from "./detail-section";

/**
 * Get the badge color classes based on the action string
 */
function getActionBadgeClasses(action: string): {
  bg: string;
  text: string;
} {
  const lowerAction = action.toLowerCase();

  // Movement actions - indigo
  if (lowerAction.includes("move") || lowerAction.includes("moved")) {
    return { bg: "bg-primary/10", text: "text-primary" };
  }

  // Creation/addition actions - emerald
  if (
    lowerAction.includes("add") ||
    lowerAction.includes("added") ||
    lowerAction.includes("create") ||
    lowerAction.includes("created")
  ) {
    return {
      bg: "bg-emerald-500/10",
      text: "text-emerald-700 dark:text-emerald-400",
    };
  }

  // Update/edit actions - amber
  if (
    lowerAction.includes("update") ||
    lowerAction.includes("updated") ||
    lowerAction.includes("edit") ||
    lowerAction.includes("edited") ||
    lowerAction.includes("change") ||
    lowerAction.includes("changed")
  ) {
    return {
      bg: "bg-amber-500/10",
      text: "text-amber-700 dark:text-amber-400",
    };
  }

  // Default - neutral gray
  return { bg: "bg-secondary", text: "text-foreground" };
}

function isBulkEditField(field: unknown): field is BulkEditField {
  return BULK_EDIT_FIELDS.some((candidate) => candidate === field);
}

/** A changed value as staff entered it: lists as their entries, not JSON. */
function changedValue(field: unknown, value: unknown) {
  return field === "materials" || field === "objectType"
    ? storedListValues(String(value)).join(", ")
    : String(value);
}

/**
 * Format the changes field for display
 */
function formatChanges(
  changes: Record<string, unknown> | undefined,
  tRoot: ReturnType<typeof useI18n>,
): React.ReactNode {
  if (!changes || typeof changes !== "object") {
    return null;
  }

  // Handle field changes pattern (e.g., { field: "title", previous: "X", new: "Y" })
  if ("field" in changes) {
    return (
      <p className="mt-0.5 font-mono text-xs text-muted-foreground">
        {tRoot("untranslatedRecords.objects.logs.fieldChanged", {
          field: isBulkEditField(changes.field)
            ? tRoot(`objects.bulkEdit.fields.${changes.field}`)
            : String(changes.field),
          previous:
            changes.previous !== undefined
              ? ` ${tRoot("untranslatedRecords.objects.logs.fromValue", { value: changedValue(changes.field, changes.previous) })}`
              : "",
          next:
            changes.new !== undefined
              ? ` ${tRoot("untranslatedRecords.objects.logs.toValue", { value: changedValue(changes.field, changes.new) })}`
              : "",
        })}
      </p>
    );
  }

  // Handle previous/new value pattern
  if ("previous" in changes && "new" in changes) {
    return (
      <div className="mt-1 flex gap-4">
        <span className="font-mono text-xs text-muted-foreground line-through">
          {String(changes.previous)}
        </span>
        <span className="font-mono text-xs text-foreground">
          {String(changes.new)}
        </span>
      </div>
    );
  }

  // Handle fileName pattern
  if ("fileName" in changes) {
    return (
      <p className="mt-0.5 font-mono text-xs text-muted-foreground">
        {tRoot("untranslatedRecords.objects.attributes.file")}{" "}
        {String(changes.fileName)}
      </p>
    );
  }

  // Handle location change pattern
  if ("previousLocation" in changes || "newLocation" in changes) {
    const previousLocation = changes.previousLocation;
    if (!previousLocation) return null;
    return (
      <p className="mt-0.5 font-mono text-xs text-muted-foreground">
        {tRoot("untranslatedRecords.objects.logs.previousLocation", {
          location: String(previousLocation),
        })}
      </p>
    );
  }

  // Fallback: show first few key-value pairs
  const entries = Object.entries(changes).slice(0, 2);
  if (entries.length > 0) {
    return (
      <p className="mt-0.5 font-mono text-xs text-muted-foreground">
        {entries.map(([key, value]) => `${key}: ${String(value)}`).join(", ")}
      </p>
    );
  }

  return null;
}

const LOG_PAGE_SIZE = 20;
/** The most entries the audit log query returns. */
const LOG_MAX = 100;

const KNOWN_ACTIONS = [
  "created_collection",
  "updated_collection",
  "archived_collection",
  "deleted_collection",
  "restored_collection",
  "received_collection_from_organization_move",
  "added_alternate_accession_number",
  "removed_alternate_accession_number",
  "created_move_request",
  "executed_move_request",
  "cancelled_move_request",
  "rejected_move_request",
  "move_request_conflict",
  "provenance_claim_recorded",
  "provenance_claim_corrected",
  "provenance_claim_retracted",
  "provenance_claim_reviewed",
  "provenance_evidence_added",
  "provenance_evidence_retracted",
] as const;

function isKnownAction(
  action: string,
): action is (typeof KNOWN_ACTIONS)[number] {
  return (KNOWN_ACTIONS as readonly string[]).includes(action);
}

interface LogsTabProps {
  collectionId: string;
  organizationId: Id<"organizations">;
  locale: string;
}

export function LogsTab({
  collectionId,
  organizationId,
  locale,
}: LogsTabProps) {
  const tRoot = useI18n();
  const tCommon = useScopedI18n("modules.common");
  const [limit, setLimit] = useState(LOG_PAGE_SIZE);
  const auditLogs = useQuery(api.auditLog.getByEntity, {
    organizationId,
    entityType: "collection",
    entityId: collectionId,
    limit,
  });
  const actionLabel = (action: string) =>
    isKnownAction(action)
      ? tRoot(`untranslatedRecords.objects.logs.actions.${action}`)
      : action;

  return (
    <DetailSection
      title={tRoot("untranslatedRecords.objects.detail.auditLog")}
      icon={ScrollText}
      bodyClassName="overflow-hidden p-0 sm:p-0"
    >
      <div className="overflow-x-auto">
        <table className="w-full text-left">
          <thead className="border-b border-border/60 bg-secondary/50">
            <tr>
              <th className="w-32 px-4 py-3 text-xs font-medium uppercase tracking-wider text-muted-foreground">
                {tRoot("deaccessions.report.date")}
              </th>
              <th className="w-48 px-4 py-3 text-xs font-medium uppercase tracking-wider text-muted-foreground">
                {tRoot("untranslatedRecords.objects.detail.user")}
              </th>
              <th className="px-4 py-3 text-xs font-medium uppercase tracking-wider text-muted-foreground">
                {tRoot("untranslatedRecords.objects.detail.actionDetails")}
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/60">
            {auditLogs === undefined ? (
              <tr>
                <td
                  colSpan={3}
                  className="px-4 py-8 text-center text-muted-foreground"
                >
                  {tRoot("untranslatedRecords.objects.loading.logs")}
                </td>
              </tr>
            ) : auditLogs.length > 0 ? (
              auditLogs.map((log) => (
                <tr
                  key={log._id}
                  className="group transition-colors hover:bg-secondary/40"
                >
                  <td className="px-4 py-3 align-top">
                    <span className="whitespace-nowrap text-xs text-muted-foreground">
                      <ClientDate
                        timestamp={log.timestamp}
                        locale={locale}
                        options={{
                          month: "short",
                          day: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                        }}
                      />
                    </span>
                  </td>
                  <td className="px-4 py-3 align-top">
                    <div className="flex items-center gap-2">
                      <Avatar className="size-5 border border-border/60">
                        <AvatarImage
                          src={log.userImage ?? undefined}
                          alt={
                            log.userName ??
                            tRoot("untranslatedRecords.objects.comments.user")
                          }
                        />
                        <AvatarFallback className="bg-secondary text-xs text-muted-foreground">
                          {log.userName?.charAt(0) || "?"}
                        </AvatarFallback>
                      </Avatar>
                      <span className="text-xs text-foreground">
                        {log.userName || tCommon("unknown")}
                      </span>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <p className="text-sm text-foreground">
                      <span
                        className={`font-medium ${getActionBadgeClasses(log.action).text}`}
                      >
                        {actionLabel(log.action)}
                      </span>
                    </p>
                    {log.action === "created_collection"
                      ? null
                      : formatChanges(
                          log.changes as Record<string, unknown> | undefined,
                          tRoot,
                        )}
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td
                  colSpan={3}
                  className="px-4 py-8 text-center text-muted-foreground"
                >
                  {tRoot("untranslatedRecords.objects.detail.noAuditLogs")}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      {auditLogs?.length === limit && limit < LOG_MAX ? (
        <div className="border-t border-border/60 px-4 py-2 text-center">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="text-muted-foreground"
            onClick={() =>
              setLimit((current) => Math.min(current + LOG_PAGE_SIZE, LOG_MAX))
            }
          >
            {tRoot("untranslatedRecords.objects.detail.loadOlderLogs")}
          </Button>
        </div>
      ) : null}
    </DetailSection>
  );
}
