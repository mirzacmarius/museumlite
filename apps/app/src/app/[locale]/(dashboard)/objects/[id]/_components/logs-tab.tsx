"use client";

import { formatDate } from "@/lib/format-date";
import { useScopedI18n } from "@/locales/client";
import { api } from "@v1/backend/convex/_generated/api";
import type { Id } from "@v1/backend/convex/_generated/dataModel";
import { useQuery } from "convex/react";
import { ScrollText } from "lucide-react";

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
        <ScrollText className="h-4 w-4 text-orange-500" />
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
                      <div className="flex h-5 w-5 items-center justify-center rounded-full border border-border/60 bg-secondary text-[9px] text-muted-foreground">
                        {log.userName?.charAt(0) || "?"}
                      </div>
                      <span className="text-xs text-muted-foreground">
                        {log.userName || tCommon("unknown")}
                      </span>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <p className="text-xs text-muted-foreground">
                      <span className="font-medium text-accent">
                        {log.action}
                      </span>
                    </p>
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
