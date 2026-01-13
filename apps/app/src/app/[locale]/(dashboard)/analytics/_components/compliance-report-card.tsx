"use client";

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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@v1/ui/tabs";
import { cn } from "@v1/ui/utils";
import {
  CheckCircle2,
  Clock,
  FileCheck,
  ScrollText,
  XCircle,
} from "lucide-react";

interface ComplianceReportCardProps {
  data: {
    accessions: {
      total: number;
      pending: number;
      approved: number;
      rejected: number;
      pendingApprovals: Array<{
        id: string;
        accessionNumber: string;
        source: string;
        dateReceived: number;
        method: string;
        assignedToName?: string;
        workflowStep?: number;
      }>;
      recentApprovals: Array<{
        id: string;
        accessionNumber: string;
        source: string;
        approvedAt: number;
        approvedByName: string;
        status: string;
      }>;
    };
    deaccessions: {
      total: number;
      pending: number;
      approved: number;
      rejected: number;
      pendingApprovals: Array<{
        id: string;
        deaccessionNumber: string;
        reason: string;
        method: string;
        dateDeaccessioned: number;
        workflowStep?: number;
      }>;
      recentApprovals: Array<{
        id: string;
        deaccessionNumber: string;
        reason: string;
        approvedAt: number;
        approvedByName: string;
        status: string;
        proceedsAmount?: number;
      }>;
    };
  };
}

function formatDate(timestamp: number): string {
  return new Date(timestamp).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}

function formatRelativeTime(timestamp: number): string {
  const now = Date.now();
  const diff = now - timestamp;
  const days = Math.floor(diff / (24 * 60 * 60 * 1000));

  if (days === 0) return "Today";
  if (days === 1) return "1d ago";
  if (days < 30) return `${days}d ago`;
  if (days < 365) return `${Math.floor(days / 30)}mo ago`;
  return `${Math.floor(days / 365)}y ago`;
}

export function ComplianceReportCard({ data }: ComplianceReportCardProps) {
  const totalPending = data.accessions.pending + data.deaccessions.pending;
  const totalApproved = data.accessions.approved + data.deaccessions.approved;
  const totalRejected = data.accessions.rejected + data.deaccessions.rejected;

  return (
    <Card className="bg-muted/30 border-white/10 backdrop-blur-sm h-full flex flex-col col-span-1 lg:col-span-2 xl:col-span-1">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium uppercase tracking-wider text-muted-foreground flex items-center gap-2">
          <FileCheck className="w-4 h-4" />
          Compliance & Approvals
        </CardTitle>
        <div className="grid grid-cols-3 gap-2 mt-4">
          <div className="bg-amber-500/10 border border-amber-500/20 rounded-md p-2 text-center group hover:bg-amber-500/20 transition-colors cursor-default">
            <div className="text-lg font-bold text-amber-500 flex items-center justify-center gap-1">
              <Clock className="w-3.5 h-3.5" />
              {totalPending}
            </div>
            <div className="text-[10px] text-amber-400 uppercase tracking-wider">
              Pending
            </div>
          </div>
          <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-md p-2 text-center group hover:bg-emerald-500/20 transition-colors cursor-default">
            <div className="text-lg font-bold text-emerald-500 flex items-center justify-center gap-1">
              <CheckCircle2 className="w-3.5 h-3.5" />
              {totalApproved}
            </div>
            <div className="text-[10px] text-emerald-400 uppercase tracking-wider">
              Approved
            </div>
          </div>
          <div className="bg-red-500/10 border border-red-500/20 rounded-md p-2 text-center group hover:bg-red-500/20 transition-colors cursor-default">
            <div className="text-lg font-bold text-red-500 flex items-center justify-center gap-1">
              <XCircle className="w-3.5 h-3.5" />
              {totalRejected}
            </div>
            <div className="text-[10px] text-red-400 uppercase tracking-wider">
              Rejected
            </div>
          </div>
        </div>
      </CardHeader>
      <CardContent className="flex-1 overflow-auto pt-2">
        <Tabs defaultValue="accessions" className="h-full flex flex-col">
          <TabsList className="grid w-full grid-cols-2 h-8 bg-muted/50">
            <TabsTrigger value="accessions" className="text-xs h-7 gap-1">
              <ScrollText className="w-3 h-3" />
              Accessions
              {data.accessions.pending > 0 && (
                <Badge
                  variant="secondary"
                  className="h-4 px-1 text-[9px] bg-amber-500/20 text-amber-500"
                >
                  {data.accessions.pending}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="deaccessions" className="text-xs h-7 gap-1">
              <ScrollText className="w-3 h-3" />
              Deaccessions
              {data.deaccessions.pending > 0 && (
                <Badge
                  variant="secondary"
                  className="h-4 px-1 text-[9px] bg-amber-500/20 text-amber-500"
                >
                  {data.deaccessions.pending}
                </Badge>
              )}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="accessions" className="flex-1 mt-3">
            <div className="space-y-4">
              {data.accessions.pendingApprovals.length > 0 && (
                <div>
                  <h4 className="text-xs font-semibold text-amber-500 mb-2 flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    Pending Approval ({data.accessions.pending})
                  </h4>
                  <div className="rounded-md border border-amber-500/20 bg-amber-500/5 overflow-hidden">
                    <Table>
                      <TableHeader>
                        <TableRow className="hover:bg-transparent border-amber-500/10 bg-amber-500/10">
                          <TableHead className="h-7 text-[10px] uppercase font-semibold text-amber-400">
                            Acc. #
                          </TableHead>
                          <TableHead className="h-7 text-[10px] uppercase font-semibold text-amber-400">
                            Source
                          </TableHead>
                          <TableHead className="h-7 text-[10px] uppercase font-semibold text-amber-400 text-right">
                            Received
                          </TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {data.accessions.pendingApprovals
                          .slice(0, 5)
                          .map((item) => (
                            <TableRow
                              key={item.id}
                              className="hover:bg-amber-500/10 border-amber-500/10"
                            >
                              <TableCell className="font-mono text-xs font-medium">
                                {item.accessionNumber}
                              </TableCell>
                              <TableCell
                                className="text-xs max-w-[100px] truncate"
                                title={item.source}
                              >
                                {item.source}
                              </TableCell>
                              <TableCell className="text-xs text-right text-muted-foreground">
                                {formatDate(item.dateReceived)}
                              </TableCell>
                            </TableRow>
                          ))}
                      </TableBody>
                    </Table>
                  </div>
                </div>
              )}

              <div>
                <h4 className="text-xs font-semibold text-muted-foreground mb-2 flex items-center gap-1">
                  <CheckCircle2 className="w-3 h-3" />
                  Recent Activity
                </h4>
                <div className="rounded-md border border-border bg-background/50 overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow className="hover:bg-transparent border-border bg-muted/30">
                        <TableHead className="h-7 text-[10px] uppercase font-semibold">
                          Acc. #
                        </TableHead>
                        <TableHead className="h-7 text-[10px] uppercase font-semibold">
                          By
                        </TableHead>
                        <TableHead className="h-7 text-[10px] uppercase font-semibold text-right">
                          Status
                        </TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {data.accessions.recentApprovals.length === 0 ? (
                        <TableRow>
                          <TableCell
                            colSpan={3}
                            className="h-16 text-center text-xs text-muted-foreground"
                          >
                            No recent approvals
                          </TableCell>
                        </TableRow>
                      ) : (
                        data.accessions.recentApprovals
                          .slice(0, 5)
                          .map((item) => (
                            <TableRow
                              key={item.id}
                              className="hover:bg-muted/30 border-border"
                            >
                              <TableCell className="font-mono text-xs font-medium">
                                {item.accessionNumber}
                              </TableCell>
                              <TableCell
                                className="text-xs max-w-[80px] truncate"
                                title={item.approvedByName}
                              >
                                {item.approvedByName}
                              </TableCell>
                              <TableCell className="text-right">
                                <Badge
                                  variant="outline"
                                  className={cn(
                                    "text-[10px] h-5 px-1.5 border-0",
                                    item.status === "approved"
                                      ? "text-emerald-500 bg-emerald-500/10 ring-1 ring-inset ring-emerald-500/20"
                                      : "text-red-500 bg-red-500/10 ring-1 ring-inset ring-red-500/20",
                                  )}
                                >
                                  {item.status === "approved"
                                    ? "Approved"
                                    : "Rejected"}
                                </Badge>
                              </TableCell>
                            </TableRow>
                          ))
                      )}
                    </TableBody>
                  </Table>
                </div>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="deaccessions" className="flex-1 mt-3">
            <div className="space-y-4">
              {data.deaccessions.pendingApprovals.length > 0 && (
                <div>
                  <h4 className="text-xs font-semibold text-amber-500 mb-2 flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    Pending Approval ({data.deaccessions.pending})
                  </h4>
                  <div className="rounded-md border border-amber-500/20 bg-amber-500/5 overflow-hidden">
                    <Table>
                      <TableHeader>
                        <TableRow className="hover:bg-transparent border-amber-500/10 bg-amber-500/10">
                          <TableHead className="h-7 text-[10px] uppercase font-semibold text-amber-400">
                            Deacc. #
                          </TableHead>
                          <TableHead className="h-7 text-[10px] uppercase font-semibold text-amber-400">
                            Reason
                          </TableHead>
                          <TableHead className="h-7 text-[10px] uppercase font-semibold text-amber-400 text-right">
                            Date
                          </TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {data.deaccessions.pendingApprovals
                          .slice(0, 5)
                          .map((item) => (
                            <TableRow
                              key={item.id}
                              className="hover:bg-amber-500/10 border-amber-500/10"
                            >
                              <TableCell className="font-mono text-xs font-medium">
                                {item.deaccessionNumber}
                              </TableCell>
                              <TableCell
                                className="text-xs max-w-[100px] truncate"
                                title={item.reason}
                              >
                                {item.reason}
                              </TableCell>
                              <TableCell className="text-xs text-right text-muted-foreground">
                                {formatDate(item.dateDeaccessioned)}
                              </TableCell>
                            </TableRow>
                          ))}
                      </TableBody>
                    </Table>
                  </div>
                </div>
              )}

              <div>
                <h4 className="text-xs font-semibold text-muted-foreground mb-2 flex items-center gap-1">
                  <CheckCircle2 className="w-3 h-3" />
                  Recent Activity
                </h4>
                <div className="rounded-md border border-border bg-background/50 overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow className="hover:bg-transparent border-border bg-muted/30">
                        <TableHead className="h-7 text-[10px] uppercase font-semibold">
                          Deacc. #
                        </TableHead>
                        <TableHead className="h-7 text-[10px] uppercase font-semibold">
                          By
                        </TableHead>
                        <TableHead className="h-7 text-[10px] uppercase font-semibold text-right">
                          Status
                        </TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {data.deaccessions.recentApprovals.length === 0 ? (
                        <TableRow>
                          <TableCell
                            colSpan={3}
                            className="h-16 text-center text-xs text-muted-foreground"
                          >
                            No recent approvals
                          </TableCell>
                        </TableRow>
                      ) : (
                        data.deaccessions.recentApprovals
                          .slice(0, 5)
                          .map((item) => (
                            <TableRow
                              key={item.id}
                              className="hover:bg-muted/30 border-border"
                            >
                              <TableCell className="font-mono text-xs font-medium">
                                {item.deaccessionNumber}
                              </TableCell>
                              <TableCell
                                className="text-xs max-w-[80px] truncate"
                                title={item.approvedByName}
                              >
                                {item.approvedByName}
                              </TableCell>
                              <TableCell className="text-right">
                                <Badge
                                  variant="outline"
                                  className={cn(
                                    "text-[10px] h-5 px-1.5 border-0",
                                    item.status === "approved"
                                      ? "text-emerald-500 bg-emerald-500/10 ring-1 ring-inset ring-emerald-500/20"
                                      : "text-red-500 bg-red-500/10 ring-1 ring-inset ring-red-500/20",
                                  )}
                                >
                                  {item.status === "approved"
                                    ? "Approved"
                                    : "Rejected"}
                                </Badge>
                              </TableCell>
                            </TableRow>
                          ))
                      )}
                    </TableBody>
                  </Table>
                </div>
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}
