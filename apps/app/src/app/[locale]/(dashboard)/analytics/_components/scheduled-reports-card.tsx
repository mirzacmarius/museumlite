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
import type { FunctionReturnType } from "convex/server";
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
import { useReducer, useState } from "react";
import { toast } from "sonner";
import { ClientDate } from "@/components/client-date";
import { useClientTimeZone } from "@/hooks/use-client-date-format";
import { formatScheduleWeekday, SCHEDULE_WEEKDAYS } from "@/lib/format-date";
import { useCurrentLocale, useScopedI18n } from "@/locales/client";

interface ScheduledReportsCardProps {
  organizationId: Id<"organizations">;
}

type ScheduledReport = FunctionReturnType<
  typeof api.reporting.listScheduledReports
>[number];
type ReportRun = FunctionReturnType<
  typeof api.reporting.listReportRuns
>[number];
type ScheduleOption = "daily" | "weekly" | "monthly" | "quarterly";
type OutputState = "generated" | "stored" | "unavailable";

const DATE_TIME_OPTIONS: Intl.DateTimeFormatOptions = {
  year: "numeric",
  month: "short",
  day: "numeric",
  weekday: "short",
  hour: "2-digit",
  minute: "2-digit",
};

export function ScheduledReportsCard({
  organizationId,
}: ScheduledReportsCardProps) {
  const t = useScopedI18n("analytics.scheduledReports");
  const reports = useQuery(api.reporting.listScheduledReports, {
    organizationId,
  });

  return (
    <Card className="border-white/10 bg-muted/30 backdrop-blur-sm">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-sm font-medium uppercase tracking-wider text-muted-foreground">
          <CalendarClock className="size-4" />
          {t("title")}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        <ScheduledReportForm organizationId={organizationId} />
        <ScheduledReportList reports={reports} />
        <RecentReportRuns organizationId={organizationId} />
      </CardContent>
    </Card>
  );
}

interface FormState {
  name: string;
  schedule: ScheduleOption;
  weekday: number;
  monthDay: string;
  time: string;
  isCreating: boolean;
}

type FormAction =
  | { type: "set-name"; value: string }
  | { type: "set-schedule"; value: ScheduleOption }
  | { type: "set-weekday"; value: number }
  | { type: "set-month-day"; value: string }
  | { type: "set-time"; value: string }
  | { type: "set-creating"; value: boolean }
  | { type: "created" };

const INITIAL_FORM_STATE: FormState = {
  name: "",
  schedule: "weekly",
  weekday: 1,
  monthDay: "1",
  time: "09:00",
  isCreating: false,
};

function formReducer(state: FormState, action: FormAction): FormState {
  switch (action.type) {
    case "set-name":
      return { ...state, name: action.value };
    case "set-schedule":
      return { ...state, schedule: action.value };
    case "set-weekday":
      return { ...state, weekday: action.value };
    case "set-month-day":
      return { ...state, monthDay: action.value };
    case "set-time":
      return { ...state, time: action.value };
    case "set-creating":
      return { ...state, isCreating: action.value };
    case "created":
      return { ...state, name: "", isCreating: false };
  }
}

function ScheduledReportForm({ organizationId }: ScheduledReportsCardProps) {
  const t = useScopedI18n("analytics.scheduledReports");
  const locale = useCurrentLocale();
  const [state, dispatch] = useReducer(formReducer, INITIAL_FORM_STATE);
  const timezone = useClientTimeZone();
  const createScheduledReport = useMutation(
    api.reporting.createScheduledReport,
  );

  async function handleCreate() {
    const name = state.name.trim();
    if (!name) {
      toast.error(t("nameRequired"));
      return;
    }

    let scheduledDay: number | undefined;
    if (state.schedule === "weekly") {
      scheduledDay = state.weekday;
    } else if (state.schedule === "monthly" || state.schedule === "quarterly") {
      scheduledDay = Number(state.monthDay);
      if (
        !Number.isInteger(scheduledDay) ||
        scheduledDay < 1 ||
        scheduledDay > 31
      ) {
        toast.error(t("dayInvalid"));
        return;
      }
    }

    dispatch({ type: "set-creating", value: true });
    try {
      await createScheduledReport({
        organizationId,
        name,
        reportType: "operational_kpis",
        schedule: state.schedule,
        scheduledDay,
        scheduledTime: state.time,
        timezone,
      });
      dispatch({ type: "created" });
      toast.success(t("created"));
    } catch (error) {
      dispatch({ type: "set-creating", value: false });
      toast.error(error instanceof Error ? error.message : t("createFailed"));
    }
  }

  return (
    <div className="space-y-3">
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
            value={state.name}
            maxLength={200}
            onChange={(event) =>
              dispatch({ type: "set-name", value: event.target.value })
            }
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
            value={state.schedule}
            onValueChange={(value) =>
              dispatch({ type: "set-schedule", value: value as ScheduleOption })
            }
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
        {state.schedule === "weekly" ? (
          <div className="space-y-1">
            <label
              htmlFor="scheduled-report-weekday"
              className="text-xs text-muted-foreground"
            >
              {t("weekdayLabel")}
            </label>
            <Select
              value={String(state.weekday)}
              onValueChange={(value) =>
                dispatch({ type: "set-weekday", value: Number(value) })
              }
            >
              <SelectTrigger
                id="scheduled-report-weekday"
                className="bg-background/50"
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {SCHEDULE_WEEKDAYS.map((day) => (
                  <SelectItem key={day} value={String(day)}>
                    {formatScheduleWeekday(day, locale)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        ) : state.schedule === "monthly" || state.schedule === "quarterly" ? (
          <div className="space-y-1">
            <label
              htmlFor="scheduled-report-month-day"
              className="text-xs text-muted-foreground"
            >
              {state.schedule === "quarterly"
                ? t("quarterDayLabel")
                : t("monthDayLabel")}
            </label>
            <Input
              id="scheduled-report-month-day"
              type="number"
              min={1}
              max={31}
              value={state.monthDay}
              onChange={(event) =>
                dispatch({ type: "set-month-day", value: event.target.value })
              }
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
            value={state.time}
            onChange={(event) =>
              dispatch({ type: "set-time", value: event.target.value })
            }
            className="bg-background/50"
          />
        </div>
        <Button
          type="button"
          size="sm"
          className="gap-2"
          onClick={handleCreate}
          disabled={state.isCreating}
        >
          {state.isCreating ? (
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
    </div>
  );
}

function ScheduledReportList({
  reports,
}: {
  reports: ScheduledReport[] | undefined;
}) {
  const t = useScopedI18n("analytics.scheduledReports");

  if (reports === undefined) return <LoadingMessage message={t("loading")} />;
  if (reports.length === 0)
    return <p className="text-sm text-muted-foreground">{t("empty")}</p>;

  return (
    <ul className="space-y-3">
      {reports.map((report) => (
        <ScheduledReportRow key={report._id} report={report} />
      ))}
    </ul>
  );
}

function ScheduledReportRow({ report }: { report: ScheduledReport }) {
  const t = useScopedI18n("analytics.scheduledReports");
  const locale = useCurrentLocale();
  const [isBusy, setIsBusy] = useState(false);
  const updateScheduledReport = useMutation(
    api.reporting.updateScheduledReport,
  );
  const deleteScheduledReport = useMutation(
    api.reporting.deleteScheduledReport,
  );
  const runReportManually = useMutation(api.reporting.runReportManually);

  async function runAction(action: () => Promise<void>) {
    setIsBusy(true);
    try {
      await action();
    } finally {
      setIsBusy(false);
    }
  }

  function handleActionFailure(error: unknown, fallback: string) {
    toast.error(error instanceof Error ? error.message : fallback);
  }

  return (
    <li className="flex flex-col gap-2 rounded-lg border border-white/10 bg-background/30 p-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0 space-y-1">
        <div className="flex flex-wrap items-center gap-2">
          <p className="truncate font-medium">{report.name}</p>
          {!report.generatorAvailable && (
            <Badge variant="outline">{t("generatorUnavailable")}</Badge>
          )}
          {!report.isActive && (
            <Badge variant="secondary">{t("pausedBadge")}</Badge>
          )}
        </div>
        <p className="text-xs text-muted-foreground">
          {describeSchedule(report, locale, t)}
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
              status: statusLabel(report.lastRunStatus, t),
            })}
          </p>
        )}
        {report.lastRunError && (
          <p className="text-xs text-destructive">{report.lastRunError}</p>
        )}
      </div>
      <div className="flex shrink-0 flex-wrap gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="gap-1"
          disabled={isBusy || !report.generatorAvailable}
          onClick={() =>
            void runAction(async () => {
              try {
                await runReportManually({ reportId: report._id });
                toast.success(t("runStarted"));
              } catch (error) {
                handleActionFailure(error, t("runFailed"));
              }
            })
          }
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
                void runAction(async () => {
                  try {
                    const isActive = !report.isActive;
                    await updateScheduledReport({
                      reportId: report._id,
                      isActive,
                    });
                    toast.success(isActive ? t("resumed") : t("paused"));
                  } catch (error) {
                    handleActionFailure(error, t("updateFailed"));
                  }
                })
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
          onClick={() =>
            void runAction(async () => {
              try {
                await deleteScheduledReport({ reportId: report._id });
                toast.success(t("deleted"));
              } catch (error) {
                handleActionFailure(error, t("deleteFailed"));
              }
            })
          }
        >
          <Trash2 className="size-3" />
          {t("delete")}
        </Button>
      </div>
    </li>
  );
}

function RecentReportRuns({ organizationId }: ScheduledReportsCardProps) {
  const t = useScopedI18n("analytics.scheduledReports");
  const recentRuns = useQuery(api.reporting.listReportRuns, {
    organizationId,
    limit: 10,
  });

  return (
    <div className="space-y-2">
      <h3 className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
        {t("recentRuns")}
      </h3>
      {recentRuns === undefined ? (
        <LoadingMessage message={t("loading")} />
      ) : recentRuns.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t("noRuns")}</p>
      ) : (
        <ul className="space-y-2">
          {recentRuns.map((run) => (
            <ReportRunRow key={run._id} run={run} />
          ))}
        </ul>
      )}
    </div>
  );
}

function ReportRunRow({ run }: { run: ReportRun }) {
  const t = useScopedI18n("analytics.scheduledReports");
  const locale = useCurrentLocale();
  const convex = useConvex();
  const retryReportRun = useMutation(api.reporting.retryReportRun);
  const [isBusy, setIsBusy] = useState(false);

  async function withBusy(action: () => Promise<void>) {
    setIsBusy(true);
    try {
      await action();
    } finally {
      setIsBusy(false);
    }
  }

  async function handleDownload() {
    await withBusy(async () => {
      try {
        const fullRun = await convex.query(api.reporting.getReportRun, {
          runId: run._id,
        });
        if (!fullRun?.artifact) {
          toast.error(t("outputUnavailable"));
          return;
        }
        const blob = new Blob([fullRun.artifact.content], {
          type: "application/json",
        });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        const stamp = new Date(fullRun.artifact.generatedAt)
          .toISOString()
          .slice(0, 16)
          .replace(/[:T]/g, "-");
        link.href = url;
        link.download = `${run.reportName.replace(/[^\w-]+/g, "_")}-${stamp}.json`;
        link.click();
        URL.revokeObjectURL(url);
      } catch (error) {
        toast.error(
          error instanceof Error ? error.message : t("downloadFailed"),
        );
      }
    });
  }

  async function handleRetry() {
    await withBusy(async () => {
      try {
        await retryReportRun({ runId: run._id });
        toast.success(t("retryStarted"));
      } catch (error) {
        toast.error(error instanceof Error ? error.message : t("retryFailed"));
      }
    });
  }

  return (
    <li className="flex flex-col gap-2 rounded-lg border border-white/10 bg-background/20 p-3 text-xs sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0 space-y-1">
        <p className="truncate text-sm font-medium">{run.reportName}</p>
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
          <Badge variant={run.status === "failed" ? "destructive" : "outline"}>
            {statusLabel(run.status, t)}
          </Badge>
          <Badge variant="outline">
            {t("outputLabel", { state: outputLabel(run.outputState, t) })}
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
            onClick={() => void handleDownload()}
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
            onClick={() => void handleRetry()}
          >
            {isBusy ? (
              <Loader2 className="size-3 animate-spin" />
            ) : (
              <RotateCcw className="size-3" />
            )}
            {t("retry")}
          </Button>
        )}
      </div>
    </li>
  );
}

function LoadingMessage({ message }: { message: string }) {
  return (
    <div className="flex items-center gap-2 text-sm text-muted-foreground">
      <Loader2 className="size-4 animate-spin" />
      {message}
    </div>
  );
}

function describeSchedule(
  report: ScheduledReport,
  locale: string,
  t: ReturnType<typeof useScopedI18n>,
) {
  const at = report.scheduledTime ?? "09:00";
  const timezone = report.timezone ?? "UTC";
  switch (report.schedule) {
    case "daily":
      return t("summaryDaily", { time: at, timezone });
    case "weekly":
      return t("summaryWeekly", {
        day: formatScheduleWeekday(report.scheduledDay ?? 1, locale),
        time: at,
        timezone,
      });
    case "monthly":
      return t("summaryMonthly", {
        day: report.scheduledDay ?? 1,
        time: at,
        timezone,
      });
    case "quarterly":
      return t("summaryQuarterly", {
        day: report.scheduledDay ?? 1,
        time: at,
        timezone,
      });
    default:
      return t("summaryOnDemand");
  }
}

function statusLabel(status: string, t: ReturnType<typeof useScopedI18n>) {
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

function outputLabel(state: OutputState, t: ReturnType<typeof useScopedI18n>) {
  switch (state) {
    case "stored":
      return t("outputStored");
    case "generated":
      return t("outputGenerated");
    default:
      return t("outputUnavailable");
  }
}
