"use client";

import { useI18n } from "@/locales/client";
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
import { ArrowDownLeft, ArrowUpRight, CalendarClock } from "lucide-react";

interface LoanCalendarCardProps {
  data: {
    overdue: number;
    dueToday: number;
    dueNext7Days: number;
    dueNext30Days: number;
    upcomingReturns: Array<{
      id: string;
      loanNumber: string;
      lenderBorrowerName: string;
      type: "incoming" | "outgoing";
      endDate: number;
      daysRemaining: number;
      status: string;
    }>;
  };
}

export function LoanCalendarCard({ data }: LoanCalendarCardProps) {
  const t = useI18n();
  return (
    <Card className="bg-muted/30 border-white/10 backdrop-blur-sm h-full flex flex-col col-span-1 lg:col-span-2 xl:col-span-1">
      <CardHeader>
        <CardTitle className="text-sm font-medium uppercase tracking-wider text-muted-foreground flex items-center gap-2">
          <CalendarClock className="w-4 h-4" />
          {t("analytics.loanCalendar.title")}
        </CardTitle>
        <div className="grid grid-cols-4 gap-2 mt-4">
          <div className="bg-red-500/10 border border-red-500/20 rounded-md p-2 text-center group hover:bg-red-500/20 transition-colors cursor-default">
            <div className="text-lg font-bold text-red-500">{data.overdue}</div>
            <div className="text-[10px] text-red-400 uppercase tracking-wider">
              {t("analytics.loanCalendar.overdue")}
            </div>
          </div>
          <div className="bg-amber-500/10 border border-amber-500/20 rounded-md p-2 text-center group hover:bg-amber-500/20 transition-colors cursor-default">
            <div className="text-lg font-bold text-amber-500">
              {data.dueToday}
            </div>
            <div className="text-[10px] text-amber-400 uppercase tracking-wider">
              {t("analytics.loanCalendar.today")}
            </div>
          </div>
          <div className="bg-blue-500/10 border border-blue-500/20 rounded-md p-2 text-center group hover:bg-blue-500/20 transition-colors cursor-default">
            <div className="text-lg font-bold text-blue-500">
              {data.dueNext7Days}
            </div>
            <div className="text-[10px] text-blue-400 uppercase tracking-wider">
              {t("analytics.loanCalendar.dueSoon")}
            </div>
          </div>
          <div className="bg-muted border border-border rounded-md p-2 text-center group hover:bg-muted/80 transition-colors cursor-default">
            <div className="text-lg font-bold text-foreground">
              {data.dueNext30Days}
            </div>
            <div className="text-[10px] text-muted-foreground uppercase tracking-wider">
              {t("analytics.loanCalendar.upcoming")}
            </div>
          </div>
        </div>
      </CardHeader>
      <CardContent className="flex-1 overflow-auto">
        <h4 className="text-xs font-semibold text-muted-foreground mb-3 uppercase tracking-wider">
          {t("analytics.loanCalendar.upcoming")}
        </h4>
        <div className="rounded-md border border-border bg-background/50 overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent border-border bg-muted/30">
                <TableHead className="h-8 text-[10px] uppercase font-semibold">
                  Loan #
                </TableHead>
                <TableHead className="h-8 text-[10px] uppercase font-semibold">
                  Partner
                </TableHead>
                <TableHead className="h-8 text-[10px] uppercase font-semibold text-right">
                  Days
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.upcomingReturns.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={3}
                    className="h-24 text-center text-xs text-muted-foreground"
                  >
                    {t("analytics.loanCalendar.noUpcoming")}
                  </TableCell>
                </TableRow>
              ) : (
                data.upcomingReturns.map((loan) => (
                  <TableRow
                    key={loan.id}
                    className="hover:bg-muted/30 border-border group cursor-default"
                  >
                    <TableCell className="font-mono text-xs font-medium">
                      <div className="flex items-center gap-1.5">
                        {loan.type === "incoming" ? (
                          <ArrowDownLeft className="w-3 h-3 text-emerald-500" />
                        ) : (
                          <ArrowUpRight className="w-3 h-3 text-blue-500" />
                        )}
                        {loan.loanNumber}
                      </div>
                    </TableCell>
                    <TableCell
                      className="text-xs max-w-[120px] truncate"
                      title={loan.lenderBorrowerName}
                    >
                      {loan.lenderBorrowerName}
                    </TableCell>
                    <TableCell className="text-right">
                      <Badge
                        variant="outline"
                        className={cn(
                          "text-[10px] h-5 px-1.5 font-mono border-0",
                          loan.daysRemaining < 0
                            ? "text-red-500 bg-red-500/10 ring-1 ring-inset ring-red-500/20"
                            : loan.daysRemaining < 7
                              ? "text-amber-500 bg-amber-500/10 ring-1 ring-inset ring-amber-500/20"
                              : "text-blue-500 bg-blue-500/10 ring-1 ring-inset ring-blue-500/20",
                        )}
                      >
                        {loan.daysRemaining < 0
                          ? `${Math.abs(loan.daysRemaining)}d ago`
                          : loan.daysRemaining === 0
                            ? t("analytics.loanCalendar.today")
                            : `${loan.daysRemaining}d`}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}
