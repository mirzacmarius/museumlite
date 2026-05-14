"use client";

import { formatDate } from "@/lib/format-date";
import { useCurrentLocale, useI18n } from "@/locales/client";
import { Badge } from "@v1/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@v1/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@v1/ui/table";
import { cn } from "@v1/ui/utils";
import { Activity, FileText, History, User } from "lucide-react";

interface AuditTrailCardProps {
  data: {
    totalEvents: number;
    recentEvents: Array<{
      id: string;
      action: string;
      entityType: string;
      entityId: string;
      userName: string;
      timestamp: number;
    }>;
    eventsByType: Array<{
      entityType: string;
      count: number;
    }>;
    eventsByUser: Array<{
      userId: string;
      userName: string;
      count: number;
    }>;
  };
}

function formatRelativeTime(
  timestamp: number,
  locale: string,
  justNowText: string,
): string {
  const now = Date.now();
  const diff = now - timestamp;
  const minutes = Math.floor(diff / (60 * 1000));
  const hours = Math.floor(diff / (60 * 60 * 1000));
  const days = Math.floor(diff / (24 * 60 * 60 * 1000));

  if (minutes < 1) return justNowText;
  if (minutes < 60) return `${minutes}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days === 1) return "1d ago";
  if (days < 30) return `${days}d ago`;
  return formatDate(new Date(timestamp), locale, {
    month: "short",
    day: "numeric",
  });
}

function getActionColor(action: string): string {
  const lowerAction = action.toLowerCase();
  if (lowerAction.includes("create") || lowerAction.includes("add"))
    return "text-emerald-500 bg-emerald-500/10 ring-emerald-500/20";
  if (lowerAction.includes("update") || lowerAction.includes("edit"))
    return "text-blue-500 bg-blue-500/10 ring-blue-500/20";
  if (lowerAction.includes("delete") || lowerAction.includes("remove"))
    return "text-red-500 bg-red-500/10 ring-red-500/20";
  if (lowerAction.includes("approve"))
    return "text-emerald-500 bg-emerald-500/10 ring-emerald-500/20";
  if (lowerAction.includes("reject"))
    return "text-red-500 bg-red-500/10 ring-red-500/20";
  return "text-muted-foreground bg-muted/50 ring-border";
}

function formatEntityType(type: string): string {
  return type
    .replace(/([A-Z])/g, " $1")
    .trim()
    .replace(/^./, (str) => str.toUpperCase());
}

export function AuditTrailCard({ data }: AuditTrailCardProps) {
  const locale = useCurrentLocale();
  const t = useI18n();
  const maxTypeCount = Math.max(...data.eventsByType.map((e) => e.count), 1);

  return (
    <Card className="bg-muted/30 border-white/10 backdrop-blur-sm h-full flex flex-col col-span-1 lg:col-span-2 xl:col-span-1">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium uppercase tracking-wider text-muted-foreground flex items-center gap-2">
          <History className="size-4" />
          {t("analytics.auditTrail.title")}
        </CardTitle>
        <div className="flex items-center gap-4 mt-4">
          <div className="flex-1 bg-muted/50 border border-border rounded-md p-3 text-center">
            <div className="text-2xl font-bold text-foreground">
              {data.totalEvents}
            </div>
            <div className="text-[10px] text-muted-foreground uppercase tracking-wider">
              {t("analytics.auditTrail.totalEvents")} (30d)
            </div>
          </div>
          <div className="flex-1 bg-muted/50 border border-border rounded-md p-3 text-center">
            <div className="text-2xl font-bold text-foreground">
              {data.eventsByUser.length}
            </div>
            <div className="text-[10px] text-muted-foreground uppercase tracking-wider">
              {t("analytics.auditTrail.byUser")}
            </div>
          </div>
        </div>
      </CardHeader>
      <CardContent className="flex-1 overflow-auto pt-2 space-y-4">
        <div>
          <h4 className="text-xs font-semibold text-muted-foreground mb-2 flex items-center gap-1">
            <Activity className="size-3" />
            {t("analytics.auditTrail.recentActivity")}
          </h4>
          <div className="rounded-md border border-border bg-background/50 overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent border-border bg-muted/30">
                  <TableHead className="h-7 text-[10px] uppercase font-semibold">
                    Action
                  </TableHead>
                  <TableHead className="h-7 text-[10px] uppercase font-semibold">
                    User
                  </TableHead>
                  <TableHead className="h-7 text-[10px] uppercase font-semibold text-right">
                    Time
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.recentEvents.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={3}
                      className="h-24 text-center text-xs text-muted-foreground"
                    >
                      No recent activity
                    </TableCell>
                  </TableRow>
                ) : (
                  data.recentEvents.slice(0, 8).map((event) => (
                    <TableRow
                      key={event.id}
                      className="hover:bg-muted/30 border-border"
                    >
                      <TableCell>
                        <div className="flex flex-col gap-0.5">
                          <Badge
                            variant="outline"
                            className={cn(
                              "text-[9px] h-4 px-1 w-fit border-0 ring-1 ring-inset",
                              getActionColor(event.action),
                            )}
                          >
                            {event.action}
                          </Badge>
                          <span className="text-[10px] text-muted-foreground">
                            {formatEntityType(event.entityType)}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell
                        className="text-xs max-w-[80px] truncate"
                        title={event.userName}
                      >
                        {event.userName}
                      </TableCell>
                      <TableCell className="text-xs text-right text-muted-foreground">
                        {formatRelativeTime(
                          event.timestamp,
                          locale,
                          t("analytics.auditTrail.justNow"),
                        )}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </div>

        {data.eventsByType.length > 0 && (
          <div>
            <h4 className="text-xs font-semibold text-muted-foreground mb-2 flex items-center gap-1">
              <FileText className="size-3" />
              {t("analytics.auditTrail.byType")}
            </h4>
            <div className="space-y-1.5">
              {data.eventsByType.slice(0, 5).map((item) => (
                <div
                  key={item.entityType}
                  className="flex items-center gap-2 text-xs"
                >
                  <div className="w-20 truncate text-muted-foreground">
                    {formatEntityType(item.entityType)}
                  </div>
                  <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
                    <div
                      className="h-full bg-blue-500/60 rounded-full"
                      style={{
                        width: `${(item.count / maxTypeCount) * 100}%`,
                      }}
                    />
                  </div>
                  <div className="w-8 text-right font-mono text-muted-foreground">
                    {item.count}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {data.eventsByUser.length > 0 && (
          <div>
            <h4 className="text-xs font-semibold text-muted-foreground mb-2 flex items-center gap-1">
              <User className="size-3" />
              {t("analytics.auditTrail.byUser")}
            </h4>
            <div className="flex flex-wrap gap-1.5">
              {data.eventsByUser.slice(0, 5).map((user) => (
                <Badge
                  key={user.userId}
                  variant="secondary"
                  className="text-[10px] h-5 px-2 bg-muted/50 gap-1"
                >
                  <span className="truncate max-w-[60px]">{user.userName}</span>
                  <span className="text-muted-foreground font-mono">
                    ({user.count})
                  </span>
                </Badge>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
