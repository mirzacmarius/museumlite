"use client";

import { api } from "@v1/backend/convex/_generated/api";
import type { Id } from "@v1/backend/convex/_generated/dataModel";
import type { PartyTargetType } from "@v1/backend/convex/utils/partyValidators";
import { Badge } from "@v1/ui/badge";
import { Button } from "@v1/ui/button";
import { usePaginatedQuery, useQuery } from "convex/react";
import Link from "next/link";
import { PartyLinkDate } from "@/components/target-party-links";
import { useCurrentLocale, useScopedI18n } from "@/locales/client";

const TARGET_ROUTES: Partial<Record<PartyTargetType, string>> = {
  accession: "/accessions",
  loan: "/loans",
  deaccession: "/deaccessions",
  collection: "/collections",
  entry: "/accessions/entries",
};

/** Every procedure role this Party has held, with what was recorded then. */
export function PartyRoleHistory({ accountId }: { accountId: Id<"accounts"> }) {
  const t = useScopedI18n("parties");
  const locale = useCurrentLocale();
  const party = useQuery(api.parties.get, { accountId });
  const partyName = party?.displayName;
  const { results, status, loadMore } = usePaginatedQuery(
    api.partyLinks.listForAccount,
    { accountId },
    { initialNumItems: 20 },
  );

  return (
    <div className="rounded-lg border border-border bg-card p-6">
      <h2 className="text-lg font-medium">{t("history.title")}</h2>
      <p className="mb-6 text-sm text-muted-foreground">
        {t("history.description")}
      </p>
      {status === "LoadingFirstPage" ? null : results.length === 0 ? (
        <div className="flex h-32 items-center justify-center text-sm text-muted-foreground">
          {t("history.empty")}
        </div>
      ) : (
        <ul className="space-y-3">
          {results.map((entry) => {
            const statusBadge = (
              <Badge variant={entry.isCurrent ? "secondary" : "outline"}>
                {entry.isCurrent
                  ? t("history.current")
                  : t("history.superseded")}
              </Badge>
            );
            if (entry.restricted) {
              return (
                <li
                  key={entry._id}
                  className="flex flex-wrap items-center gap-2 rounded-lg border border-border p-4 text-sm"
                >
                  <Badge variant="outline">{t(`roles.${entry.role}`)}</Badge>
                  <span className="text-muted-foreground">
                    {t(`targetTypes.${entry.targetType}`)}
                  </span>
                  <span className="font-medium">{t("history.restricted")}</span>
                  {statusBadge}
                </li>
              );
            }
            const route = TARGET_ROUTES[entry.targetType];
            return (
              <li
                key={entry._id}
                className="space-y-1 rounded-lg border border-border p-4 text-sm"
              >
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="outline">{t(`roles.${entry.role}`)}</Badge>
                  <span className="text-muted-foreground">
                    {t(`targetTypes.${entry.targetType}`)}
                  </span>
                  {route ? (
                    <Link
                      href={`${route}/${entry.targetId}`}
                      className="font-medium underline-offset-4 hover:underline"
                    >
                      {entry.targetLabel}
                    </Link>
                  ) : (
                    <span className="font-medium">{entry.targetLabel}</span>
                  )}
                  {statusBadge}
                </div>
                {entry.nameSnapshot !== partyName ? (
                  <p className="text-muted-foreground">
                    {t("links.recordedAs", { name: entry.nameSnapshot })}
                  </p>
                ) : null}
                {entry.assertedName ? (
                  <p className="text-muted-foreground">
                    {t("links.namedOnRecord", { name: entry.assertedName })}
                  </p>
                ) : null}
                <p className="text-xs text-muted-foreground">
                  <PartyLinkDate
                    kind="from"
                    timestamp={entry.effectiveFrom}
                    locale={locale}
                  />
                  {entry.supersededAt ? (
                    <>
                      {" · "}
                      <PartyLinkDate
                        kind="replacedOn"
                        timestamp={entry.supersededAt}
                        locale={locale}
                      />
                    </>
                  ) : null}
                </p>
                {entry.supersessionReason ? (
                  <p className="text-xs text-muted-foreground">
                    {t("links.reason", { reason: entry.supersessionReason })}
                  </p>
                ) : null}
              </li>
            );
          })}
        </ul>
      )}
      {status === "CanLoadMore" ? (
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="mt-4"
          onClick={() => loadMore(20)}
        >
          {t("history.loadMore")}
        </Button>
      ) : null}
    </div>
  );
}
