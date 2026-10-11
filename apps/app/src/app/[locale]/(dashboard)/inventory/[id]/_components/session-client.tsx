"use client";

import { api } from "@v1/backend/convex/_generated/api";
import type { Id } from "@v1/backend/convex/_generated/dataModel";
import { Progress } from "@v1/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@v1/ui/tabs";
import { useQuery } from "convex/react";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { parseAsStringLiteral, useQueryState } from "nuqs";
import { RecordRecoveryState } from "@/components/record-recovery-state";
import { useRecordViewState } from "@/hooks/use-return-path";
import { useCurrentLocale, useScopedI18n } from "@/locales/client";
import { formatMoment } from "../../_components/inventory-format";
import { SessionStatusBadge } from "../../_components/session-status-badge";
import { ExceptionList } from "./exception-list";
import { ExpectedList } from "./expected-list";
import { ObservationList } from "./observation-list";
import { ScanPanel } from "./scan-panel";
import { SessionActions } from "./session-actions";
import type { SessionView } from "./session-types";

const TABS = ["scan", "expected", "observations", "exceptions"] as const;
type SessionTab = (typeof TABS)[number];

function defaultTab(session: SessionView): SessionTab {
  if (session.status === "scanning")
    return session.canWork ? "scan" : "expected";
  if (session.status === "cancelled") return "observations";
  return "exceptions";
}

function SessionHistory({ session }: { session: SessionView }) {
  const t = useScopedI18n("inventory.session");
  const locale = useCurrentLocale();
  const someone = t("unknownPerson");
  return (
    <ul className="space-y-0.5 text-xs text-muted-foreground">
      <li>
        {t("startedBy", {
          name: session.startedByName ?? someone,
          date: formatMoment(session.startedAt, locale),
        })}
      </li>
      {session.finishedAt ? (
        <li>
          {t("finishedBy", {
            name: session.finishedByName ?? someone,
            date: formatMoment(session.finishedAt, locale),
          })}
        </li>
      ) : null}
      {session.cancelledAt ? (
        <li className="break-words">
          {t("cancelledBy", {
            name: session.cancelledByName ?? someone,
            date: formatMoment(session.cancelledAt, locale),
            reason: session.cancelReason ?? "",
          })}
        </li>
      ) : null}
      {session.reconciledAt ? (
        <li>
          {t("reconciledOn", {
            date: formatMoment(session.reconciledAt, locale),
          })}
        </li>
      ) : null}
    </ul>
  );
}

function SessionDetail({ session }: { session: SessionView }) {
  const t = useScopedI18n("inventory");
  const [tab, setTab] = useQueryState(
    "tab",
    parseAsStringLiteral(TABS).withOptions({
      history: "replace",
      scroll: false,
    }),
  );
  const canScan = session.status === "scanning" && session.canWork;
  const requested = tab ?? defaultTab(session);
  const activeTab = requested === "scan" && !canScan ? "expected" : requested;
  const scope =
    session.scopeLocations.find(
      (location) => location._id === session.scopeLocationId,
    )?.name ?? "";

  return (
    <div className="mx-auto w-full max-w-5xl space-y-6 p-4 sm:p-6">
      <div className="space-y-3">
        <Link
          href="/inventory"
          className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="size-4" />
          {t("session.back")}
        </Link>
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="break-words text-xl font-semibold">{session.name}</h1>
          <SessionStatusBadge status={session.status} />
        </div>
        <p className="break-words text-sm text-muted-foreground">
          {session.includeSublocations
            ? t("withSublocations", { location: scope })
            : scope}
        </p>
        <div className="space-y-1">
          <Progress
            value={session.progress.observed}
            max={Math.max(session.progress.expected, 1)}
            aria-label={t("progress", {
              observed: session.progress.observed,
              expected: session.progress.expected,
            })}
          />
          <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm">
            <span>
              {t("progress", {
                observed: session.progress.observed,
                expected: session.progress.expected,
              })}
            </span>
            <span className="text-muted-foreground">
              {t("remaining", { count: session.progress.remaining })}
            </span>
            {session.status !== "scanning" && session.status !== "cancelled" ? (
              <span className="text-muted-foreground">
                {t("session.exceptionsOpen", {
                  count: session.openExceptionCount,
                })}
              </span>
            ) : null}
          </div>
        </div>
        <SessionHistory session={session} />
        <SessionActions session={session} />
        {!session.canWork ? (
          <p className="rounded-md border border-border p-3 text-sm text-muted-foreground">
            {t("workUnavailable")}
          </p>
        ) : null}
      </div>

      <Tabs
        value={activeTab}
        onValueChange={(value) => void setTab(value as SessionTab)}
      >
        <TabsList className="flex h-auto flex-wrap justify-start">
          {canScan ? (
            <TabsTrigger value="scan">{t("session.tabs.scan")}</TabsTrigger>
          ) : null}
          <TabsTrigger value="expected">
            {t("session.tabs.expected")}
          </TabsTrigger>
          <TabsTrigger value="observations">
            {t("session.tabs.observations")}
          </TabsTrigger>
          <TabsTrigger value="exceptions">
            {t("session.tabs.exceptions")}
          </TabsTrigger>
        </TabsList>
        {canScan ? (
          <TabsContent value="scan" className="pt-4">
            <ScanPanel session={session} />
          </TabsContent>
        ) : null}
        <TabsContent value="expected" className="pt-4">
          <ExpectedList sessionId={session._id} />
        </TabsContent>
        <TabsContent value="observations" className="pt-4">
          <ObservationList sessionId={session._id} />
        </TabsContent>
        <TabsContent value="exceptions" className="pt-4">
          <ExceptionList session={session} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

export function SessionClient({ sessionId }: { sessionId: string }) {
  const session = useQuery(api.inventory.getSession, {
    sessionId: sessionId as Id<"inventorySessions">,
  });
  const viewState = useRecordViewState(session);

  if (session === undefined)
    return (
      <div className="flex size-full items-center justify-center">
        <div className="h-8 w-48 animate-pulse rounded-md bg-muted/60" />
      </div>
    );
  if (session === null)
    return (
      <RecordRecoveryState
        kind={viewState === "removed" ? "removed" : "missing"}
        list="inventory"
      />
    );
  return <SessionDetail session={session} />;
}
