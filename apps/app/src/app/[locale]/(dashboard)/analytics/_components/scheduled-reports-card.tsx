"use client";

import { api } from "@v1/backend/convex/_generated/api";
import type { Id } from "@v1/backend/convex/_generated/dataModel";
import { Badge } from "@v1/ui/badge";
import { Button } from "@v1/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@v1/ui/card";
import { Input } from "@v1/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@v1/ui/select";
import { useConvex, useMutation, useQuery } from "convex/react";
import {
  CalendarClock,
  Download,
  Loader2,
  Pause,
  Play,
  Plus,
  RotateCcw,
  Trash2,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { ClientDate } from "@/components/client-date";
import { useCurrentLocale, useScopedI18n } from "@/locales/client";

interface ScheduledReportsCardProps {
  organizationId: Id<"organizations">;
}

type ScheduleOption = "daily" | "weekly" | "monthly" | "quarterly";

const WEEKDAYS = [0, 1, 2, 3, 4, 5, 6] as const;

const DATE_TIME_OPTIONS: Intl.DateTimeFormatOptions = {
  year: "numeric",
  month: "short",
  day: "numeric",
  weekday: "short",
  hour: "2-digit",
  minute: "2-digit",
};

function getBrowserTimezone() {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  } catch {
    return "UTC";
  }
}

function weekdayName(day: number) {
  // 2023-01-01 was a Sunday, so day N maps to 2023-01-0(1+N).
  return new Intl.DateTimeFormat(undefined, {
    weekday: "long",
    timeZone: "UTC",
  }).format(Date.UTC(2023, 0, 1 + day));
}

export function ScheduledReportsCard({
  organizationId,
}: ScheduledReportsCardProps) {
  const t = useScopedI18n("analytics.scheduledReports");
  const locale = useCurrentLocale();
  const convex = useConvex();
  const [timezone] = useState(getBrowserTimezone);
  const [name, setName] = useState("");
  const [schedule, setSchedule] = useState<ScheduleOption>("weekly");
  const [weekday, setWeekday] = useState(1);
  const [monthDay, setMonthDay] = useState("1");
  const [time, setTime] = useState("09:00");
  const [isCreating, setIsCreating] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  const reports = useQuery(api.reporting.listScheduledReports, {
    organizationId,
  });

  const recentRuns = useQuery(api.reporting.listReportRuns, {
    organizationId,
    limit: 10,
  });

  const createScheduledReport = useMutation(
    api.reporting.createScheduledReport,
  );
  const updateScheduledReport = useMutation(
    api.reporting.updateScheduledReport,
  );
  const deleteScheduledReport = useMutation(
    api.reporting.deleteScheduledReport,
  );
  const runReportManually = useMutation(api.reporting.runReportManually);
  const retryReportRun = useMutation(api.reporting.retryReportRun);

  async function withBusy(id: string, action: () => Promise<void>) {
    setBusyId(id);
    try {
      await action();
    } finally {
      setBusyId(null);
    }
  }

  async function handleCreate() {
    const trimmedName = name.trim();
    if (!trimmedName) {
      toast.error(t("nameRequired"));
      return;
    }
    let scheduledDay: number | undefined;
    if (schedule === "weekly") {
      scheduledDay = weekday;
    } else if (schedule === "monthly" || schedule === "quarterly") {
      scheduledDay = Number(monthDay);
      if (
        !Number.isInteger(scheduledDay) ||
        scheduledDay < 1 ||
        scheduledDay > 31
      ) {
        toast.error(t("dayInvalid"));
        return;
      }
    }

    setIsCreating(true);
    try {
      await createScheduledReport({
        organizationId,
        name: trimmedName,
        reportType: "operational_kpis",
        schedule,
        scheduledDay,
        scheduledTime: time,
        timezone,
      });
      setName("");
      toast.success(t("created"));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("createFailed"));
    } finally {
      setIsCreating(false);
    }
  }

  async function handleDelete(reportId: Id<"scheduledReports">) {
    await withBusy(reportId, async () => {
      try {
        await deleteScheduledReport({ reportId });
        toast.success(t("deleted"));
      } catch (error) {
        toast.error(error instanceof Error ? error.message : t("deleteFailed"));
      }
    });
  }

  async function handleRun(reportId: Id<"scheduledReports">) {
    await withBusy(reportId, async () => {
      try {
        await runReportManually({ reportId });
        toast.success(t("runStarted"));
      } catch (error) {
        toast.error(error instanceof Error ? error.message : t("runFailed"));
      }
    });
  }

  async function handleToggleActive(
    reportId: Id<"scheduledReports">,
    isActive: boolean,
  ) {
    await withBusy(reportId, async () => {
      try {
        await updateScheduledReport({ reportId, isActive });
        toast.success(isActive ? t("resumed") : t("paused"));
      } catch (error) {
        toast.error(error instanceof Error ? error.message : t("updateFailed"));
      }
    });
  }

  async function handleRetry(runId: Id<"reportRuns">) {
    await withBusy(runId, async () => {
      try {
        await retryReportRun({ runId });
        toast.success(t("retryStarted"));
      } catch (error) {
        toast.error(error instanceof Error ? error.message : t("retryFailed"));
      }
    });
  }

  async function handleDownload(runId: Id<"reportRuns">, reportName: string) {
    await withBusy(runId, async () => {
      try {
        const run = await convex.query(api.reporting.getReportRun, { runId });
        if (!run?.artifact) {
          toast.error(t("outputUnavailable"));
          return;
        }
        const blob = new Blob([run.artifact.content], {
          type: "application/json",
        });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        const stamp = new Date(run.artifact.generatedAt)
          .toISOString()
          .slice(0, 16)
          .replace(/[:T]/g, "-");
        link.href = url;
        link.download = `${reportName.replace(/[^\w-]+/g, "_")}-${stamp}.json`;
        link.click();
        URL.revokeObjectURL(url);
      } catch (error) {
        toast.error(
          error instanceof Error ? error.message : t("downloadFailed"),
        );
      }
    });
  }

  function describeSchedule(report: NonNullable<typeof reports>[number]) {
    const at = report.scheduledTime ?? "09:00";
    const zone = report.timezone ?? "UTC";
    switch (report.schedule) {
      case "daily":
        return t("summaryDaily", { time: at, timezone: zone });
      case "weekly":
        return t("summaryWeekly", {
          day: weekdayName(report.scheduledDay ?? 1),
          time: at,
          timezone: zone,
        });
      case "monthly":
        return t("summaryMonthly", {
          day: report.scheduledDay ?? 1,
          time: at,
          timezone: zone,
        });
      case "quarterly":
        return t("summaryQuarterly", {
          day: report.scheduledDay ?? 1,
          time: at,
          timezone: zone,
        });
      default:
        return t("summaryOnDemand");
    }
  }

  function statusLabel(status: string) {
    switch (status) {
      case "running":
        return t("statusRunning");
      case "success":
        return t("statusSuccess");
      case "failed":
        return t("statusFailed");
      case "partial":
        return t("statusPartial");
      default:
        return t("statusCancelled");
    }
  }

  function outputLabel(state: "generated" | "stored" | "unavailable") {
    if (state === "stored") return t("outputStored");
    if (state === "generated") return t("outputGenerated");
    return t("outputUnavailable");
  }

  return (
    <Card className="bg-muted/30 border-white/10 backdrop-blur-sm">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-medium uppercase tracking-wider text-muted-foreground flex items-center gap-2">
          <CalendarClock className="size-4" />
          {t("title")}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-[minmax(0,2fr)_repeat(3,minmax(0,1fr))_auto] lg:items-end">
          <div className="space-y-1 sm:col-span-2 lg:col-span-1">
            <label
              htmlFor="scheduled-report-name"
              className="text-xs text-muted-foreground"
            >
              {t("nameLabel")}
            </label>
            <Input
              id="scheduled-report-name"
              value={name}
              maxLength={200}
              onChange={(e) => setName(e.target.value)}
              placeholder={t("namePlaceholder")}
              className="bg-background/50"
            />
          </div>
          <div className="space-y-1">
            <label
              htmlFor="scheduled-report-schedule"
              className="text-xs text-muted-foreground"
            >
              {t("scheduleLabel")}
            </label>
            <Select
              value={schedule}
              onValueChange={(value) => setSchedule(value as ScheduleOption)}
            >
              <SelectTrigger
                id="scheduled-report-schedule"
                className="bg-background/50"
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="daily">{t("scheduleDaily")}</SelectItem>
                <SelectItem value="weekly">{t("scheduleWeekly")}</SelectItem>
                <SelectItem value="monthly">{t("scheduleMonthly")}</SelectItem>
                <SelectItem value="quarterly">
                  {t("scheduleQuarterly")}
                </SelectItem>
              </SelectContent>
            </Select>
          </div>
          {schedule === "weekly" ? (
            <div className="space-y-1">
              <label
                htmlFor="scheduled-report-weekday"
                className="text-xs text-muted-foreground"
              >
                {t("weekdayLabel")}
              </label>
              <Select
                value={String(weekday)}
                onValueChange={(value) => setWeekday(Number(value))}
              >
                <SelectTrigger
                  id="scheduled-report-weekday"
                  className="bg-background/50"
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {WEEKDAYS.map((day) => (
                    <SelectItem key={day} value={String(day)}>
                      {weekdayName(day)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          ) : schedule === "monthly" || schedule === "quarterly" ? (
            <div className="space-y-1">
              <label
                htmlFor="scheduled-report-month-day"
                className="text-xs text-muted-foreground"
              >
                {schedule === "quarterly"
                  ? t("quarterDayLabel")
                  : t("monthDayLabel")}
              </label>
              <Input
                id="scheduled-report-month-day"
                type="number"
                min={1}
                max={31}
                value={monthDay}
                onChange={(e) => setMonthDay(e.target.value)}
                className="bg-background/50"
              />
            </div>
          ) : (
            <div className="hidden lg:block" />
          )}
          <div className="space-y-1">
            <label
              htmlFor="scheduled-report-time"
              className="text-xs text-muted-foreground"
            >
              {t("timeLabel")}
            </label>
            <Input
              id="scheduled-report-time"
              type="time"
              value={time}
              onChange={(e) => setTime(e.target.value)}
              className="bg-background/50"
            />
          </div>
          <Button
            type="button"
            size="sm"
            className="gap-2"
            onClick={handleCreate}
            disabled={isCreating}
          >
            {isCreating ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Plus className="size-4" />
            )}
            {t("create")}
          </Button>
        </div>

        <div className="space-y-1 text-xs text-muted-foreground">
          <p>{t("timezoneHint", { timezone })}</p>
          <p>{t("reportTypeHint")}</p>
          <p>{t("outputHint")}</p>
        </div>

        {reports === undefined ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" />
            {t("loading")}
          </div>
        ) : reports.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t("empty")}</p>
        ) : (
          <ul className="space-y-3">
            {reports.map((report) => {
              const isBusy = busyId === report._id;
              return (
                <li
                  key={report._id}
                  className="flex flex-col gap-2 rounded-lg border border-white/10 bg-background/30 p-3 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="min-w-0 space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-medium truncate">{report.name}</p>
                      {!report.generatorAvailable && (
                        <Badge variant="outline">
                          {t("generatorUnavailable")}
                        </Badge>
                      )}
                      {!report.isActive && (
                        <Badge variant="secondary">{t("pausedBadge")}</Badge>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {describeSchedule(report)}
                      {report.isActive && report.nextRunAt != null && (
                        <>
                          {" · "}
                          {t("nextRun")}{" "}
                          <ClientDate
                            timestamp={report.nextRunAt}
                            locale={locale}
                            options={DATE_TIME_OPTIONS}
                          />
                        </>
                      )}
                    </p>
                    {report.lastRunStatus && (
                      <p className="text-xs text-muted-foreground">
                        {t("lastRunStatus", {
                          status: statusLabel(report.lastRunStatus),
                        })}
                      </p>
                    )}
                    {report.lastRunError && (
                      <p className="text-xs text-destructive">
                        {report.lastRunError}
                      </p>
                    )}
                  </div>
                  <div className="flex shrink-0 flex-wrap gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="gap-1"
                      disabled={isBusy || !report.generatorAvailable}
                      onClick={() => handleRun(report._id)}
                    >
                      {isBusy ? (
                        <Loader2 className="size-3 animate-spin" />
                      ) : (
                        <Play className="size-3" />
                      )}
                      {t("runNow")}
                    </Button>
                    {report.schedule !== "on_demand" &&
                      (report.isActive || report.generatorAvailable) && (
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="gap-1"
                          disabled={isBusy}
                          onClick={() =>
                            handleToggleActive(report._id, !report.isActive)
                          }
                        >
                          {report.isActive ? (
                            <Pause className="size-3" />
                          ) : (
                            <Play className="size-3" />
                          )}
                          {report.isActive ? t("pause") : t("resume")}
                        </Button>
                      )}
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="gap-1 text-destructive hover:text-destructive"
                      disabled={isBusy}
                      onClick={() => handleDelete(report._id)}
                    >
                      <Trash2 className="size-3" />
                      {t("delete")}
                    </Button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}

        <div className="space-y-2">
          <h3 className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
            {t("recentRuns")}
          </h3>
          {recentRuns === undefined ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="size-4 animate-spin" />
              {t("loading")}
            </div>
          ) : recentRuns.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t("noRuns")}</p>
          ) : (
            <ul className="space-y-2">
              {recentRuns.map((run) => {
                const isBusy = busyId === run._id;
                return (
                  <li
                    key={run._id}
                    className="flex flex-col gap-2 rounded-lg border border-white/10 bg-background/20 p-3 text-xs sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div className="min-w-0 space-y-1">
                      <p className="truncate font-medium text-sm">
                        {run.reportName}
                      </p>
                      <p className="text-muted-foreground">
                        <ClientDate
                          timestamp={run.startedAt}
                          locale={locale}
                          options={DATE_TIME_OPTIONS}
                        />
                        {" · "}
                        {run.triggeredBy === "schedule"
                          ? t("triggeredSchedule")
                          : t("triggeredManual")}
                      </p>
                      <div className="flex flex-wrap gap-2">
                        <Badge
                          variant={
                            run.status === "failed" ? "destructive" : "outline"
                          }
                        >
                          {statusLabel(run.status)}
                        </Badge>
                        <Badge variant="outline">
                          {t("outputLabel", {
                            state: outputLabel(run.outputState),
                          })}
                        </Badge>
                        <Badge variant="outline">
                          {run.deliveryState === "delivered"
                            ? t("deliveryDelivered")
                            : t("deliveryUnavailable")}
                        </Badge>
                      </div>
                      {run.errorMessage && (
                        <p className="text-destructive">{run.errorMessage}</p>
                      )}
                    </div>
                    <div className="flex shrink-0 gap-2">
                      {run.outputState === "stored" && (
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="gap-1"
                          disabled={isBusy}
                          onClick={() =>
                            handleDownload(run._id, run.reportName)
                          }
                        >
                          <Download className="size-3" />
                          {t("downloadJson")}
                        </Button>
                      )}
                      {run.status === "failed" && run.scheduledReportId && (
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="gap-1"
                          disabled={isBusy}
                          onClick={() => handleRetry(run._id)}
                        >
                          <RotateCcw className="size-3" />
                          {t("retry")}
                        </Button>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
