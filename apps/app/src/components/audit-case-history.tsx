"use client";

import { api } from "@v1/backend/convex/_generated/api";
import type { Id } from "@v1/backend/convex/_generated/dataModel";
import { Button } from "@v1/ui/button";
import { useQuery } from "convex/react";
import { parseAsInteger, useQueryState } from "nuqs";
import { Suspense } from "react";
import { ClientTime } from "@/components/client-date";
import { formatIsoTimestamp } from "@/lib/format-date";
import { useScopedI18n } from "@/locales/client";

const LOCAL_DATE_TIME_OPTIONS: Intl.DateTimeFormatOptions = {
  year: "numeric",
  month: "numeric",
  day: "numeric",
};

function parseCase(value: string): {
  caseType:
    | "accession"
    | "deaccession"
    | "loan"
    | "exhibition"
    | "conservation"
    | "acquisition";
  entityId: string;
} | null {
  const separator = value.indexOf(":");
  const type = value.slice(0, separator);
  const entityId = value.slice(separator + 1);
  const caseType =
    type === "conservationTreatment"
      ? "conservation"
      : type === "libraryAcquisitionRequest"
        ? "acquisition"
        : type;
  if (separator < 0 || !entityId) return null;
  if (
    caseType === "accession" ||
    caseType === "deaccession" ||
    caseType === "loan" ||
    caseType === "exhibition" ||
    caseType === "conservation" ||
    caseType === "acquisition"
  )
    return { caseType, entityId };
  return null;
}

function AuditCaseHistoryContent({
  organizationId,
  caseId,
}: {
  organizationId: Id<"organizations">;
  caseId: string;
}) {
  const t = useScopedI18n("activityLog");
  const subject = parseCase(caseId);
  const [cursor, setCursor] = useQueryState("caseCursor", parseAsInteger);
  const result = useQuery(
    api.auditLog.listCaseHistory,
    subject
      ? { organizationId, ...subject, cursor: cursor ?? undefined, limit: 50 }
      : "skip",
  );
  if (!subject) return null;
  return (
    <section className="space-y-3 rounded-lg border border-border p-4">
      <h3 className="font-medium">{t("approvalHistory")}</h3>
      {result === undefined ? (
        <p>{t("loading")}</p>
      ) : (
        <>
          {result.entries.map(({ ordinal, entry, evidenceStatus }) => (
            <div
              key={ordinal}
              className="flex flex-wrap justify-between gap-2 border-t border-border py-2 text-sm"
            >
              <span>
                {ordinal + 1}. {entry.approverName ?? t("unknownUser")} ·{" "}
                {entry.comment ?? `#${entry.step}`}{" "}
                {evidenceStatus === "legacy" && (
                  <span className="text-muted-foreground">({t("legacy")})</span>
                )}
              </span>
              <time
                dateTime={formatIsoTimestamp(entry.approvedAt)}
                className="text-xs text-muted-foreground"
              >
                <ClientTime
                  timestamp={entry.approvedAt}
                  options={LOCAL_DATE_TIME_OPTIONS}
                />
              </time>
            </div>
          ))}
          <div className="flex gap-2">
            {cursor !== null && (
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  void setCursor(null);
                }}
              >
                {t("firstPage")}
              </Button>
            )}
            {result.nextCursor !== undefined && (
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  void setCursor(result.nextCursor!);
                }}
              >
                {t("loadMore")}
              </Button>
            )}
          </div>
        </>
      )}
    </section>
  );
}

export function AuditCaseHistory(props: {
  organizationId: Id<"organizations">;
  caseId: string;
}) {
  return (
    <Suspense>
      <AuditCaseHistoryContent {...props} />
    </Suspense>
  );
}
