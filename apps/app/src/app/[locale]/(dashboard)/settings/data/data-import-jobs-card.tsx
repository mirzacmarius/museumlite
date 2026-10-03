"use client";

import { Badge } from "@v1/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@v1/ui/card";
import { Progress } from "@v1/ui/progress";
import { AlertCircle, CheckCircle2, Loader2 } from "lucide-react";

import { useI18n, useScopedI18n } from "@/locales/client";
interface ImportJob {
  _id: string;
  type: string;
  status: string;
  processedItems: number;
  totalItems: number;
  progress: number;
}

interface DataImportJobsCardProps {
  importJobs: ImportJob[];
}

export function DataImportJobsCard({ importJobs }: DataImportJobsCardProps) {
  const tRoot = useI18n();
  const tDashboard = useScopedI18n("untranslatedDashboard.settings");
  if (importJobs.length === 0) {
    return null;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{tDashboard("recentImportJobs")}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {importJobs.map((job) => (
            <div
              key={job._id}
              className="flex items-center justify-between rounded-lg border p-4"
            >
              <div className="flex items-center gap-4">
                {job.status === "completed" ? (
                  <CheckCircle2 className="size-5 text-green-500" />
                ) : job.status === "failed" ? (
                  <AlertCircle className="size-5 text-red-500" />
                ) : (
                  <Loader2 className="size-5 animate-spin text-blue-500" />
                )}
                <div>
                  <p className="font-medium capitalize">{job.type} {tRoot("untranslatedRecords.objects.actions.import")}</p>
                  <p className="text-sm text-muted-foreground">
                    {job.processedItems} / {job.totalItems} {tDashboard("items")}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-4">
                <Progress value={job.progress} className="w-32" />
                <Badge
                  variant={
                    job.status === "completed"
                      ? "default"
                      : job.status === "failed"
                        ? "destructive"
                        : "secondary"
                  }
                >
                  {job.status === "completed"
                    ? tDashboard("statusCompleted")
                    : job.status === "failed"
                      ? tDashboard("statusFailed")
                      : tDashboard("statusProcessing")}
                </Badge>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
