"use client";

import { api } from "@v1/backend/convex/_generated/api";
import type { Id } from "@v1/backend/convex/_generated/dataModel";
import { Button } from "@v1/ui/button";
import { useMutation, useQuery } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import { Play, RotateCcw, Square } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { usePermissions } from "@/components/permission-gate";
import { useClientDateFns } from "@/hooks/use-client-date-format";
import { useQualityErrorMessage } from "@/hooks/use-quality-error-message";
import { useCurrentLocale, useScopedI18n } from "@/locales/client";

type CheckView = NonNullable<
  FunctionReturnType<
    typeof api.documentationQuality.getCheckOverview
  >["current"]
>;

/** Matches the backend: a running check idle this long can be resumed. */
const STALE_AFTER_MS = 10 * 60 * 1000;
const CLOCK_INTERVAL_MS = 30 * 1000;

function useClock() {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), CLOCK_INTERVAL_MS);
    return () => window.clearInterval(id);
  }, []);
  return now;
}

function CheckStatus({
  check,
  stalled,
}: {
  check: CheckView;
  stalled: boolean;
}) {
  const t = useScopedI18n("documentationQuality.check");
  const locale = useCurrentLocale();
  const finishedOn = useClientDateFns(
    check.finishedAt,
    "MMM d, yyyy HH:mm",
    locale,
  );
  const phase = t(`phases.${check.phase}`);
  switch (check.status) {
    case "running":
      return (
        <>
          {stalled
            ? t("stalled", { number: check.number })
            : t("running", {
                number: check.number,
                phase,
                step: check.phaseIndex + 1,
                steps: check.phaseCount,
                records: check.checkedRecords,
              })}
        </>
      );
    case "completed":
      return (
        <>
          {t("completed", {
            number: check.number,
            date: finishedOn,
            records: check.checkedRecords,
            detected: check.detected,
            opened: check.opened,
            reopened: check.reopened,
            resolved: check.resolved,
          })}
        </>
      );
    case "failed":
      return (
        <>
          {t("failed", { number: check.number, phase })}{" "}
          {check.failureCode ? t(`failures.${check.failureCode}`) : null}
        </>
      );
    case "cancelled":
      return <>{t("cancelled", { number: check.number })}</>;
  }
}

/**
 * The latest quality check: its progress or outcome, and the commands that
 * start, cancel or resume a check.
 */
export function CheckPanel({
  organizationId,
}: {
  organizationId: Id<"organizations">;
}) {
  const t = useScopedI18n("documentationQuality.check");
  const errorMessage = useQualityErrorMessage();
  const { hasPermission } = usePermissions();
  const overview = useQuery(api.documentationQuality.getCheckOverview, {
    organizationId,
  });
  const startCheck = useMutation(api.documentationQuality.startCheck);
  const cancelCheck = useMutation(api.documentationQuality.cancelCheck);
  const resumeCheck = useMutation(api.documentationQuality.resumeCheck);
  const [isWorking, setIsWorking] = useState(false);
  const now = useClock();
  const current = overview?.current ?? null;
  const stalled =
    current?.status === "running" && now - current.updatedAt > STALE_AFTER_MS;

  async function run(command: () => Promise<unknown>, success: string) {
    setIsWorking(true);
    try {
      await command();
      toast.success(success);
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setIsWorking(false);
    }
  }

  return (
    <section
      aria-labelledby="quality-check-title"
      className="space-y-3 rounded-xl border border-border bg-card p-4 sm:p-6"
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 space-y-1">
          <h2 id="quality-check-title" className="text-base font-medium">
            {t("title")}
          </h2>
          <p
            className="text-sm text-muted-foreground"
            role="status"
            aria-live="polite"
          >
            {overview === undefined ? (
              t("loading")
            ) : current ? (
              <CheckStatus check={current} stalled={stalled} />
            ) : (
              t("never")
            )}
          </p>
        </div>
        {overview ? (
          <div className="flex flex-wrap gap-2">
            {current?.status !== "running" ? (
              <Button
                size="sm"
                disabled={isWorking}
                onClick={() =>
                  run(() => startCheck({ organizationId }), t("started"))
                }
              >
                <Play className="mr-1 size-4" />
                {t("run")}
              </Button>
            ) : null}
            {current &&
            (current.status === "failed" ||
              (current.status === "running" && stalled)) ? (
              <Button
                size="sm"
                variant="outline"
                disabled={isWorking}
                onClick={() =>
                  run(() => resumeCheck({ checkId: current._id }), t("resumed"))
                }
              >
                <RotateCcw className="mr-1 size-4" />
                {t("resume")}
              </Button>
            ) : null}
            {current?.status === "running" || current?.status === "failed" ? (
              <Button
                size="sm"
                variant="outline"
                disabled={isWorking}
                onClick={() =>
                  run(
                    () => cancelCheck({ checkId: current._id }),
                    t("cancelledToast"),
                  )
                }
              >
                <Square className="mr-1 size-4" />
                {t("cancel")}
              </Button>
            ) : null}
          </div>
        ) : null}
      </div>
      {current ? (
        <ul className="space-y-1 text-xs text-muted-foreground">
          {current.profileCount === 0 ? <li>{t("noProfiles")}</li> : null}
          {current.partiesChecked ? null : <li>{t("partiesNotChecked")}</li>}
          {current.identifierIndexIncomplete ? (
            <li>
              {t("identifierIndexIncomplete")}{" "}
              {hasPermission("organization.manage_settings") ? (
                <Link
                  href="/settings/preferences"
                  className="underline underline-offset-2"
                >
                  {t("identifierIndexLink")}
                </Link>
              ) : null}
            </li>
          ) : null}
          <li>{t("neverChanges")}</li>
        </ul>
      ) : null}
    </section>
  );
}
