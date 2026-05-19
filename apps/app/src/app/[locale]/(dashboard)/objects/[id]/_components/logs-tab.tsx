"use client";

import { formatDate } from "@/lib/format-date";
import { useScopedI18n } from "@/locales/client";
import { api } from "@v1/backend/convex/_generated/api";
import type { Id } from "@v1/backend/convex/_generated/dataModel";
import { Avatar, AvatarFallback, AvatarImage } from "@v1/ui/avatar";
import { useQuery } from "convex/react";
import { ScrollText } from "lucide-react";

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
    return { bg: "bg-emerald-500/10", text: "text-emerald-400" };
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
    return { bg: "bg-amber-500/10", text: "text-amber-400" };
  }

  // Default - neutral gray
  return { bg: "bg-secondary", text: "text-foreground" };
}

/**
 * Format the changes field for display
 */
function formatChanges(
  changes: Record<string, unknown> | undefined,
): React.ReactNode {
  if (!changes || typeof changes !== "object") {
    return null;
  }

  // Handle previous/new value pattern
  if ("previous" in changes && "new" in changes) {
    return (
      <div className="mt-1 flex gap-4">
        <span className="font-mono text-[10px] text-muted-foreground line-through">
          {String(changes.previous)}
        </span>
        <span className="font-mono text-[10px] text-foreground">
          {String(changes.new)}
        </span>
      </div>
    );
  }

  // Handle fileName pattern
  if ("fileName" in changes) {
    return (
      <p className="mt-0.5 font-mono text-[10px] text-muted-foreground">
        File: {String(changes.fileName)}
      </p>
    );
  }

  // Handle location change pattern
  if ("previousLocation" in changes || "newLocation" in changes) {
    const previousLocation = changes.previousLocation;
    if (!previousLocation) return null;
    return (
      <p className="mt-0.5 font-mono text-[10px] text-muted-foreground">
        Previous: {String(previousLocation)}
      </p>
    );
  }

  // Handle field changes pattern (e.g., { field: "title", previous: "X", new: "Y" })
  if ("field" in changes) {
    return (
      <p className="mt-0.5 font-mono text-[10px] text-muted-foreground">
        Changed &quot;{String(changes.field)}&quot;
        {changes.previous !== undefined &&
          ` from "${String(changes.previous)}"`}
        {changes.new !== undefined && ` to "${String(changes.new)}"`}
      </p>
    );
  }

  // Fallback: show first few key-value pairs
  const entries = Object.entries(changes).slice(0, 2);
  if (entries.length > 0) {
    return (
      <p className="mt-0.5 font-mono text-[10px] text-muted-foreground">
        {entries.map(([key, value]) => `${key}: ${String(value)}`).join(", ")}
      </p>
    );
  }

  return null;
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
  const tCommon = useScopedI18n("modules.common");
  const auditLogs = useQuery(api.auditLog.getByEntity, {
    organizationId,
    entityType: "collection",
    entityId: collectionId,
    limit: 20,
  });

  return (
    <div className="space-y-6">
      <h3 className="flex items-center gap-2 text-xs font-medium text-foreground">
        <ScrollText className="size-4 text-orange-500" />
        Audit Log
      </h3>

      <div className="overflow-hidden rounded-xl border border-border/60 bg-secondary/20">
        <table className="w-full text-left">
          <thead className="border-b border-border/60 bg-secondary/50">
            <tr>
              <th className="w-32 px-4 py-3 text-[10px] font-semibold uppercase text-muted-foreground">
                Date
              </th>
              <th className="w-48 px-4 py-3 text-[10px] font-semibold uppercase text-muted-foreground">
                User
              </th>
              <th className="px-4 py-3 text-[10px] font-semibold uppercase text-muted-foreground">
                Action Details
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
                  Loading logs...
                </td>
              </tr>
            ) : auditLogs.length > 0 ? (
              auditLogs.map((log) => (
                <tr
                  key={log._id}
                  className="group transition-colors hover:bg-secondary/40"
                >
                  <td className="px-4 py-3 align-top">
                    <span className="font-mono text-xs text-muted-foreground">
                      {formatDate(new Date(log.timestamp), locale, {
                        month: "short",
                        day: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </span>
                  </td>
                  <td className="px-4 py-3 align-top">
                    <div className="flex items-center gap-2">
                      <Avatar className="size-5 border border-border/60">
                        <AvatarImage
                          src={log.userImage ?? undefined}
                          alt={log.userName ?? "User"}
                        />
                        <AvatarFallback className="bg-secondary text-[9px] text-muted-foreground">
                          {log.userName?.charAt(0) || "?"}
                        </AvatarFallback>
                      </Avatar>
                      <span className="text-xs text-foreground">
                        {log.userName || tCommon("unknown")}
                      </span>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <p className="text-xs text-foreground">
                      <span
                        className={`font-medium ${getActionBadgeClasses(log.action).text}`}
                      >
                        {log.action}
                      </span>
                    </p>
                    {formatChanges(
                      log.changes as Record<string, unknown> | undefined,
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
                  No audit logs found
                </td>
              </tr>
            )}
          </tbody>
        </table>
        {auditLogs && auditLogs.length > 0 && (
          <div className="border-t border-border/60 bg-secondary/30 px-4 py-3 text-center">
            <button
              type="button"
              className="text-xs text-muted-foreground transition-colors hover:text-muted-foreground"
            >
              Load older logs...
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
