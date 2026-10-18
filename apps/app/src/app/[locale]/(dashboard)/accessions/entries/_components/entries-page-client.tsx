"use client";

import { api } from "@v1/backend/convex/_generated/api";
import type { Id } from "@v1/backend/convex/_generated/dataModel";
import type { EntryStatus } from "@v1/backend/convex/utils/objectEntryValidators";
import { Button } from "@v1/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@v1/ui/select";
import { usePaginatedQuery } from "convex/react";
import { Plus } from "lucide-react";
import Link from "next/link";
import { parseAsStringLiteral, useQueryState } from "nuqs";
import { useState } from "react";
import { ClientDateFns } from "@/components/client-date";
import { PermissionGate } from "@/components/permission-gate";
import { useListReturnPath } from "@/hooks/use-return-path";
import { withReturnPath } from "@/lib/return-path";
import { useCurrentLocale, useScopedI18n } from "@/locales/client";
import { EntryStatusBadge, entryDueAt } from "./entry-status-badge";

const ENTRY_STATUSES = [
  "in_custody",
  "acquisition_review",
  "accessioned",
  "exited",
] as const satisfies readonly EntryStatus[];
const ALL = "all";
const ENTRY_LIST_KEYS = ["status"] as const;

export function EntriesPageClient({
  organizationId,
}: {
  organizationId: Id<"organizations">;
}) {
  const t = useScopedI18n("objectEntries");
  const locale = useCurrentLocale();
  const [now] = useState(() => Date.now());
  const [status, setStatus] = useQueryState(
    "status",
    parseAsStringLiteral(ENTRY_STATUSES),
  );
  const returnPath = useListReturnPath(ENTRY_LIST_KEYS);
  const {
    results,
    status: loadStatus,
    loadMore,
  } = usePaginatedQuery(
    api.objectEntries.list,
    { organizationId, status: status ?? undefined },
    { initialNumItems: 50 },
  );

  return (
    <div className="flex h-full flex-col p-6">
      <div className="mb-6 flex min-h-[52px] flex-wrap items-center justify-between gap-4">
        <p className="max-w-2xl text-sm text-muted-foreground">
          {t("description")}
        </p>
        <div className="flex items-center gap-3">
          <Select
            value={status ?? ALL}
            onValueChange={(value) =>
              setStatus(value === ALL ? null : (value as EntryStatus))
            }
          >
            <SelectTrigger
              className="h-8 w-52 text-xs"
              aria-label={t("columns.status")}
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>{t("allStatuses")}</SelectItem>
              {ENTRY_STATUSES.map((value) => (
                <SelectItem key={value} value={value}>
                  {t(`status.${value}`)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <PermissionGate permission="collections.create">
            <Button asChild size="sm" className="h-8">
              <Link href="/accessions/entries/new">
                <Plus className="size-4" />
                {t("receive")}
              </Link>
            </Button>
          </PermissionGate>
        </div>
      </div>

      <div className="overflow-x-auto rounded-2xl border border-border/60">
        <table className="w-full min-w-[760px] text-sm">
          <thead className="bg-muted/40 text-left text-xs text-muted-foreground">
            <tr>
              <th className="px-4 py-2 font-medium">{t("columns.entry")}</th>
              <th className="px-4 py-2 font-medium">{t("columns.object")}</th>
              <th className="px-4 py-2 font-medium">
                {t("columns.depositor")}
              </th>
              <th className="px-4 py-2 font-medium">{t("columns.received")}</th>
              <th className="px-4 py-2 font-medium">{t("columns.status")}</th>
              <th className="px-4 py-2 font-medium">{t("columns.due")}</th>
              <th className="px-4 py-2 font-medium">
                {t("columns.responsible")}
              </th>
            </tr>
          </thead>
          <tbody>
            {results.map((entry) => {
              const dueAt = entryDueAt(entry);
              return (
                <tr
                  key={entry.entryId}
                  className="border-t border-border/60 hover:bg-muted/30"
                >
                  <td className="px-4 py-2 font-medium">
                    <Link
                      href={withReturnPath(
                        `/accessions/entries/${entry.entryId}`,
                        returnPath,
                      )}
                      className="hover:underline"
                    >
                      {entry.entryNumber}
                    </Link>
                  </td>
                  <td className="px-4 py-2">{entry.objectTitle ?? "-"}</td>
                  <td className="px-4 py-2">{entry.depositorName}</td>
                  <td className="px-4 py-2">
                    <ClientDateFns
                      timestamp={entry.receivedAt}
                      format="MMM d, yyyy"
                      locale={locale}
                    />
                  </td>
                  <td className="px-4 py-2">
                    <EntryStatusBadge status={entry.status} />
                  </td>
                  <td className="px-4 py-2">
                    {dueAt === undefined ? (
                      "-"
                    ) : (
                      <span
                        className={
                          dueAt < now
                            ? "font-medium text-red-600 dark:text-red-400"
                            : undefined
                        }
                      >
                        <ClientDateFns
                          timestamp={dueAt}
                          format="MMM d, yyyy"
                          locale={locale}
                        />
                        {dueAt < now ? ` · ${t("overdue")}` : null}
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-2">{entry.responsibleName ?? "-"}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {loadStatus !== "LoadingFirstPage" && results.length === 0 ? (
          <p className="px-4 py-8 text-center text-sm text-muted-foreground">
            {status ? t("emptyFiltered") : t("empty")}
          </p>
        ) : null}
      </div>
      {loadStatus === "CanLoadMore" ? (
        <div className="mt-4 flex justify-center">
          <Button variant="outline" size="sm" onClick={() => loadMore(50)}>
            {t("loadMore")}
          </Button>
        </div>
      ) : null}
    </div>
  );
}
