"use client";

import { api } from "@v1/backend/convex/_generated/api";
import type { Id } from "@v1/backend/convex/_generated/dataModel";
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
import { useMutation, useQuery } from "convex/react";
import { CalendarClock, Loader2, Play, Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { ClientTime } from "@/components/client-date";
import { useScopedI18n } from "@/locales/client";

interface ScheduledReportsCardProps {
  organizationId: Id<"organizations">;
}

type ScheduleOption = "daily" | "weekly" | "monthly";

export function ScheduledReportsCard({
  organizationId,
}: ScheduledReportsCardProps) {
  const t = useScopedI18n("analytics.scheduledReports");
  const [name, setName] = useState("");
  const [schedule, setSchedule] = useState<ScheduleOption>("weekly");
  const [isCreating, setIsCreating] = useState(false);
  const [runningReportId, setRunningReportId] = useState<
    Id<"scheduledReports"> | null
  >(null);

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
  const deleteScheduledReport = useMutation(
    api.reporting.deleteScheduledReport,
  );
  const runReportManually = useMutation(api.reporting.runReportManually);

  async function handleCreate() {
    const trimmedName = name.trim();
    if (!trimmedName) {
      toast.error(t("nameRequired"));
      return;
    }

    setIsCreating(true);
    try {
      await createScheduledReport({
        organizationId,
        name: trimmedName,
        reportType: "operational_kpis",
        schedule,
        scheduledTime: "09:00",
        timezone: "UTC",
      });
      setName("");
      toast.success(t("created"));
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : t("createFailed"),
      );
    } finally {
      setIsCreating(false);
    }
  }

  async function handleDelete(reportId: Id<"scheduledReports">) {
    try {
      await deleteScheduledReport({ reportId });
      toast.success(t("deleted"));
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : t("deleteFailed"),
      );
    }
  }

  async function handleRun(reportId: Id<"scheduledReports">) {
    setRunningReportId(reportId);
    try {
      await runReportManually({ reportId });
      toast.success(t("runStarted"));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("runFailed"));
    } finally {
      setRunningReportId(null);
    }
  }

  function getLatestRunStatus(reportName: string) {
    const run = recentRuns?.find((r) => r.reportName === reportName);
    return run?.status;
  }

  const operationalReports =
    reports?.filter((r) => r.reportType === "operational_kpis") ?? [];

  return (
    <Card className="bg-muted/30 border-white/10 backdrop-blur-sm">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-medium uppercase tracking-wider text-muted-foreground flex items-center gap-2">
          <CalendarClock className="size-4" />
          {t("title")}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <div className="flex-1 space-y-1">
            <label
              htmlFor="scheduled-report-name"
              className="text-xs text-muted-foreground"
            >
              {t("nameLabel")}
            </label>
            <Input
              id="scheduled-report-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={t("namePlaceholder")}
              className="bg-background/50"
            />
          </div>
          <div className="w-full space-y-1 sm:w-40">
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
              </SelectContent>
            </Select>
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

        <p className="text-xs text-muted-foreground">{t("reportTypeHint")}</p>

        {reports === undefined ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" />
            {t("loading")}
          </div>
        ) : operationalReports.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t("empty")}</p>
        ) : (
          <ul className="space-y-3">
            {operationalReports.map((report) => {
              const lastStatus = getLatestRunStatus(report.name);
              const isRunning = runningReportId === report._id;

              return (
                <li
                  key={report._id}
                  className="flex flex-col gap-2 rounded-lg border border-white/10 bg-background/30 p-3 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="min-w-0 space-y-1">
                    <p className="font-medium truncate">{report.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {t("scheduleSummary", { schedule: report.schedule })}
                      {report.nextRunAt != null && (
                        <>
                          {" · "}
                          {t("nextRun")}{" "}
                          <ClientTime timestamp={report.nextRunAt} />
                        </>
                      )}
                    </p>
                    {lastStatus && (
                      <p className="text-xs text-muted-foreground">
                        {t("lastRunStatus", { status: lastStatus })}
                      </p>
                    )}
                  </div>
                  <div className="flex shrink-0 gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="gap-1"
                      disabled={isRunning}
                      onClick={() => handleRun(report._id)}
                    >
                      {isRunning ? (
                        <Loader2 className="size-3 animate-spin" />
                      ) : (
                        <Play className="size-3" />
                      )}
                      {t("runNow")}
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="gap-1 text-destructive hover:text-destructive"
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
      </CardContent>
    </Card>
  );
}
