"use client";

import { api } from "@v1/backend/convex/_generated/api";
import type { Id } from "@v1/backend/convex/_generated/dataModel";
import { REPRODUCTION_STATUSES } from "@v1/backend/convex/utils/reproductionRequestValidators";
import { Button } from "@v1/ui/button";
import { usePaginatedQuery } from "convex/react";
import { FileImage } from "lucide-react";
import Link from "next/link";
import { useListState } from "@/hooks/use-list-state";
import { useListReturnPath } from "@/hooks/use-return-path";
import { defineListState } from "@/lib/list-state";
import { withReturnPath } from "@/lib/return-path";
import { useScopedI18n } from "@/locales/client";
import { RequestStatusBadge, useRequestDate } from "./request-status";

const PAGE_SIZE = 25;
const STATUS_FILTERS = ["all", ...REPRODUCTION_STATUSES] as const;

/** The request list URL: status and loaded depth. */
export const requestListState = defineListState({
  filters: { status: STATUS_FILTERS },
  sorts: ["newest"],
  pageSize: PAGE_SIZE,
  maxDepth: PAGE_SIZE * 20,
  search: false,
});

export function RequestsList({
  organizationId,
}: {
  organizationId: Id<"organizations">;
}) {
  const t = useScopedI18n("reproductionRequests");
  const tList = useScopedI18n("listState");
  const list = useListState(requestListState);
  const returnPath = useListReturnPath(requestListState.keys);
  const formatDate = useRequestDate();
  const { status } = list.state.filters;
  const {
    results,
    status: loadStatus,
    loadMore,
  } = usePaginatedQuery(
    api.reproductionRequests.list,
    { organizationId, status: status === "all" ? undefined : status },
    { initialNumItems: list.state.show },
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        {STATUS_FILTERS.map((value) => (
          <Button
            key={value}
            size="sm"
            variant={status === value ? "default" : "outline"}
            aria-pressed={status === value}
            onClick={() => list.update({ filters: { status: value } })}
          >
            {t(`statuses.${value}`)}
          </Button>
        ))}
      </div>

      {loadStatus === "LoadingFirstPage" ? (
        <p className="text-sm text-muted-foreground" role="status">
          {tList("loading")}
        </p>
      ) : results.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-border p-8 text-center">
          <FileImage className="size-8 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">
            {status === "all" ? t("list.empty") : t("list.emptyStatus")}
          </p>
        </div>
      ) : (
        <ul className="space-y-2">
          {results.map((request) => (
            <li key={request._id}>
              <Link
                href={withReturnPath(
                  `/reproduction-requests/${request._id}`,
                  returnPath,
                )}
                className="flex flex-col gap-2 rounded-lg border border-border bg-card p-3 transition-colors hover:bg-muted/40 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="min-w-0 space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-mono text-sm">
                      {request.requestNumber}
                    </span>
                    <RequestStatusBadge status={request.status} />
                  </div>
                  <p className="break-words text-sm text-foreground">
                    {request.requesterName}
                    {request.objectLabel ? ` · ${request.objectLabel}` : null}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {t(`purposes.${request.purpose}`)}
                  </p>
                </div>
                <span className="shrink-0 text-xs text-muted-foreground">
                  {t("list.received", { date: formatDate(request.createdAt) })}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}

      {loadStatus === "CanLoadMore" || loadStatus === "LoadingMore" ? (
        <div className="flex justify-center">
          <Button
            variant="outline"
            disabled={loadStatus === "LoadingMore"}
            onClick={() => {
              loadMore(PAGE_SIZE);
              list.loadMore();
            }}
          >
            {loadStatus === "LoadingMore"
              ? tList("loading")
              : tList("loadMore")}
          </Button>
        </div>
      ) : null}
    </div>
  );
}
