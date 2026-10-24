"use client";

import { api } from "@v1/backend/convex/_generated/api";
import type { Id } from "@v1/backend/convex/_generated/dataModel";
import {
  BULK_EDIT_FIELDS,
  type BulkEditField,
} from "@v1/backend/convex/utils/bulkFieldEdits";
import { isDefaultMovementReason } from "@v1/backend/convex/utils/movementReasons";
import { storedListValues } from "@v1/backend/convex/utils/objectSearchDocuments";
import { Avatar, AvatarFallback, AvatarImage } from "@v1/ui/avatar";
import { Button } from "@v1/ui/button";
import { useQuery } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import { ScrollText } from "lucide-react";
import { type ReactNode, useState } from "react";
import { ClientDate } from "@/components/client-date";
import { useObjectDescriptionFormat } from "@/components/object-description/use-object-description-format";
import { useProductionDateFormat } from "@/components/production-date/use-production-date-format";
import {
  describeObjectDescriptionValue,
  type ObjectDescriptionFormat,
} from "@/lib/object-description-format";
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

/** Names of the description fields a catalog save logs under their keys. */
const DESCRIPTION_FIELD_LABELS: Readonly<Record<string, string>> = {
  numberOfObjects: "recordForm.objectFields.numberOfObjects",
  subjects: "recordForm.objectFields.subjects",
  dimensionMeasuredPart: "recordForm.objectFields.measuredPart",
  measurementSets: "recordForm.objectFields.measurementSets",
  completeness: "recordForm.objectFields.completeness",
  completenessNote: "recordForm.objectFields.completenessNote",
  rightsStatement: "recordForm.objectFields.rightsStatement",
};

/**
 * A logged value of a description field as "Subject: Horses, Riders", with
 * names instead of codes and URIs. Null for other fields.
 */
function describedChange(
  key: string,
  value: unknown,
  tRoot: ReturnType<typeof useI18n>,
  format: ObjectDescriptionFormat,
) {
  const labelKey = Object.hasOwn(DESCRIPTION_FIELD_LABELS, key)
    ? DESCRIPTION_FIELD_LABELS[key]
    : undefined;
  if (!labelKey) return null;
  const shown = describeObjectDescriptionValue(key, value, format);
  return shown === null ? tRoot(labelKey) : `${tRoot(labelKey)}: ${shown}`;
}

/**
 * Format the changes field for display
 */
function formatChanges(
  changes: Record<string, unknown> | undefined,
  tRoot: ReturnType<typeof useI18n>,
  structuredDate: (edtf: string) => string,
  description: ObjectDescriptionFormat,
): React.ReactNode {
  if (!changes || typeof changes !== "object") {
    return null;
  }

  // Handle field changes pattern (e.g., { field: "title", previous: "X", new: "Y" })
  if ("field" in changes) {
    return (
      <>
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
        {/* A bulk set or clear of Date made also removes the structured date. */}
        {typeof changes.clearedEdtf === "string" ? (
          <p className="mt-0.5 font-mono text-xs text-muted-foreground">
            {tRoot("untranslatedRecords.objects.logs.structuredDateRemoved", {
              value: structuredDate(changes.clearedEdtf),
            })}
          </p>
        ) : null}
      </>
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

  // A move request's own entry: its reason, without the record ids
  if ("requestId" in changes) {
    return typeof changes.reason === "string" && changes.reason ? (
      <p className="mt-0.5 break-words text-xs text-muted-foreground">
        {changes.reason}
      </p>
    ) : null;
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

  // Fallback: show the first few changed fields; who saved and when are
  // already in their own columns.
  const entries = Object.entries(changes)
    .filter(([key]) => key !== "lastModifiedBy" && key !== "lastModifiedAt")
    .slice(0, 2);
  if (entries.length > 0) {
    return (
      <p className="mt-0.5 font-mono text-xs text-muted-foreground">
        {entries
          .map(
            ([key, value]) =>
              describedChange(key, value, tRoot, description) ??
              `${key}: ${String(value)}`,
          )
          .join(" · ")}
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
  "approved_move_request",
  "reapproved_move_request",
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

type AuditLogEntry = FunctionReturnType<
  typeof api.auditLog.getByEntity
>[number];
type Movement = FunctionReturnType<
  typeof api.locations.getCollectionLocationHistory
>[number];
type LogEntry =
  | { type: "audit"; at: number; created: number; log: AuditLogEntry }
  | { type: "movement"; at: number; created: number; movement: Movement };

/**
 * The Object's audit entries and movements, newest first; what one save
 * wrote at the same moment is in the order it was written. Movements before
 * `olderThan` wait until the audit entries around them are loaded. A
 * completed move request's entry is left out while its movement is listed,
 * which says the same with the Locations named.
 */
function newestEntries(
  auditLogs: AuditLogEntry[],
  movements: Movement[],
  olderThan: number | undefined,
) {
  const listed = new Set<string>();
  const entries: LogEntry[] = [];
  for (const movement of movements) {
    if (olderThan !== undefined && movement.movedAt < olderThan) continue;
    listed.add(movement._id);
    entries.push({
      type: "movement",
      at: movement.movedAt,
      created: movement._creationTime,
      movement,
    });
  }
  for (const log of auditLogs) {
    if (
      log.action === "executed_move_request" &&
      listed.has(String(log.changes?.movementId))
    )
      continue;
    entries.push({
      type: "audit",
      at: log.timestamp,
      created: log._creationTime,
      log,
    });
  }
  return entries.sort((a, b) => b.at - a.at || b.created - a.created);
}

function LogRow({
  timestamp,
  userName,
  userImage,
  locale,
  children,
}: {
  timestamp: number;
  userName: string | undefined;
  userImage?: string;
  locale: string;
  children: ReactNode;
}) {
  const tRoot = useI18n();
  const tCommon = useScopedI18n("modules.common");
  return (
    <tr className="group transition-colors hover:bg-secondary/40">
      <td className="px-4 py-3 align-top">
        <span className="whitespace-nowrap text-xs text-muted-foreground">
          <ClientDate
            timestamp={timestamp}
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
              src={userImage}
              alt={
                userName ?? tRoot("untranslatedRecords.objects.comments.user")
              }
            />
            <AvatarFallback className="bg-secondary text-xs text-muted-foreground">
              {userName?.charAt(0) || "?"}
            </AvatarFallback>
          </Avatar>
          <span className="text-xs text-foreground">
            {userName || tCommon("unknown")}
          </span>
        </div>
      </td>
      <td className="px-4 py-3">{children}</td>
    </tr>
  );
}

/** Where a movement took the Object, how, and why (MUS-868). */
function MovementDetails({ movement }: { movement: Movement }) {
  const tRoot = useI18n();
  const t = useScopedI18n("locations.movements");
  const from =
    movement.fromLocationName ??
    (movement.fromLocationId ? t("unknownLocation") : t("noLocation"));
  return (
    <>
      <p className="text-sm text-foreground">
        <span className={`font-medium ${getActionBadgeClasses("moved").text}`}>
          {tRoot("untranslatedRecords.objects.logs.moved")}
        </span>
      </p>
      <p className="mt-0.5 break-words font-mono text-xs text-muted-foreground">
        {movement.toLocationId
          ? tRoot("untranslatedRecords.objects.logs.movedFromTo", {
              from,
              to: movement.toLocationName || t("unknownLocation"),
            })
          : tRoot("untranslatedRecords.objects.logs.movedOutOf", { from })}
      </p>
      <p className="mt-0.5 text-xs text-muted-foreground">
        {t(`history.kind.${movement.movementKind ?? "legacy"}`)}
        {movement.authorizedBy &&
          ` · ${t("history.authorizedBy", { name: movement.authorizedByName ?? t("unknownUser") })}`}
      </p>
      {/* A reason the server filled in only repeats the kind, in English. */}
      {movement.reason && !isDefaultMovementReason(movement.reason) && (
        <p className="mt-0.5 break-words text-xs text-muted-foreground">
          {movement.reason}
        </p>
      )}
      {movement.notes && (
        <p className="mt-0.5 break-words text-xs text-muted-foreground">
          {movement.notes}
        </p>
      )}
    </>
  );
}

interface LogsTabProps {
  collectionId: Id<"collections">;
  organizationId: Id<"organizations">;
  locale: string;
}

export function LogsTab({
  collectionId,
  organizationId,
  locale,
}: LogsTabProps) {
  const tRoot = useI18n();
  const dates = useProductionDateFormat();
  const description = useObjectDescriptionFormat();
  const [limit, setLimit] = useState(LOG_PAGE_SIZE);
  const auditLogs = useQuery(api.auditLog.getByEntity, {
    organizationId,
    entityType: "collection",
    entityId: collectionId,
    limit,
  });
  // Every movement, as the Placement tab listed them before (MUS-868).
  const movements = useQuery(api.locations.getCollectionLocationHistory, {
    collectionId,
  });
  // A full page may have older audit entries; past the most the query
  // returns, the remaining movements are listed without them.
  const hasOlder = auditLogs?.length === limit && limit < LOG_MAX;
  const entries =
    auditLogs === undefined || movements === undefined
      ? undefined
      : newestEntries(
          auditLogs,
          movements,
          hasOlder ? auditLogs.at(-1)?.timestamp : undefined,
        );
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
            {entries === undefined ? (
              <tr>
                <td
                  colSpan={3}
                  className="px-4 py-8 text-center text-muted-foreground"
                >
                  {tRoot("untranslatedRecords.objects.loading.logs")}
                </td>
              </tr>
            ) : entries.length > 0 ? (
              entries.map((entry) =>
                entry.type === "movement" ? (
                  <LogRow
                    key={entry.movement._id}
                    timestamp={entry.at}
                    userName={entry.movement.movedByName}
                    locale={locale}
                  >
                    <MovementDetails movement={entry.movement} />
                  </LogRow>
                ) : (
                  <LogRow
                    key={entry.log._id}
                    timestamp={entry.at}
                    userName={entry.log.userName}
                    userImage={entry.log.userImage}
                    locale={locale}
                  >
                    <p className="text-sm text-foreground">
                      <span
                        className={`font-medium ${getActionBadgeClasses(entry.log.action).text}`}
                      >
                        {actionLabel(entry.log.action)}
                      </span>
                    </p>
                    {entry.log.action === "created_collection"
                      ? null
                      : formatChanges(
                          entry.log.changes as
                            | Record<string, unknown>
                            | undefined,
                          tRoot,
                          (edtf) =>
                            dates.dateMade({ dateCreatedEdtf: edtf }) ?? edtf,
                          description,
                        )}
                  </LogRow>
                ),
              )
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
      {hasOlder ? (
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
