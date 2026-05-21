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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@v1/ui/tabs";
import { cn } from "@v1/ui/utils";
import {
  CheckCircle2,
  Clock,
  FileCheck,
  ScrollText,
  XCircle,
} from "lucide-react";
import type * as React from "react";

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

type ComplianceReportData = ComplianceReportCardProps["data"];
type ComplianceSectionType = "accessions" | "deaccessions";
type PendingApproval =
  | ComplianceReportData["accessions"]["pendingApprovals"][number]
  | ComplianceReportData["deaccessions"]["pendingApprovals"][number];
type RecentApproval =
  | ComplianceReportData["accessions"]["recentApprovals"][number]
  | ComplianceReportData["deaccessions"]["recentApprovals"][number];

function formatDateShort(timestamp: number, locale: string): string {
  return formatDate(new Date(timestamp), locale, {
    month: "short",
    day: "numeric",
  });
}

function formatRelativeTime(timestamp: number, todayLabel: string): string {
  const now = Date.now();
  const diff = now - timestamp;
  const days = Math.floor(diff / (24 * 60 * 60 * 1000));

  if (days === 0) return todayLabel;
  if (days === 1) return "1d ago";
  if (days < 30) return `${days}d ago`;
  if (days < 365) return `${Math.floor(days / 30)}mo ago`;
  return `${Math.floor(days / 365)}y ago`;
}

function ComplianceSummaryGrid({ data }: { data: ComplianceReportData }) {
  const t = useI18n();
  const totalPending = data.accessions.pending + data.deaccessions.pending;
  const totalApproved = data.accessions.approved + data.deaccessions.approved;
  const totalRejected = data.accessions.rejected + data.deaccessions.rejected;

  return (
    <div className="grid grid-cols-3 gap-2 mt-4">
      <ComplianceSummaryTile
        icon={<Clock className="size-3.5" />}
        label={t("analytics.compliance.pending")}
        tone="amber"
        value={totalPending}
      />
      <ComplianceSummaryTile
        icon={<CheckCircle2 className="size-3.5" />}
        label={t("analytics.compliance.status.approved")}
        tone="emerald"
        value={totalApproved}
      />
      <ComplianceSummaryTile
        icon={<XCircle className="size-3.5" />}
        label={t("analytics.compliance.status.rejected")}
        tone="red"
        value={totalRejected}
      />
    </div>
  );
}

function ComplianceSummaryTile({
  icon,
  label,
  tone,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  tone: "amber" | "emerald" | "red";
  value: number;
}) {
  const toneClasses = {
    amber: "bg-amber-500/10 border-amber-500/20 hover:bg-amber-500/20",
    emerald: "bg-emerald-500/10 border-emerald-500/20 hover:bg-emerald-500/20",
    red: "bg-red-500/10 border-red-500/20 hover:bg-red-500/20",
  };
  const valueClasses = {
    amber: "text-amber-500",
    emerald: "text-emerald-500",
    red: "text-red-500",
  };
  const labelClasses = {
    amber: "text-amber-400",
    emerald: "text-emerald-400",
    red: "text-red-400",
  };

  return (
    <div
      className={cn(
        "border rounded-md p-2 text-center group transition-colors cursor-default",
        toneClasses[tone],
      )}
    >
      <div
        className={cn(
          "text-lg font-bold flex items-center justify-center gap-1",
          valueClasses[tone],
        )}
      >
        {icon}
        {value}
      </div>
      <div
        className={cn(
          "text-[10px] uppercase tracking-wider",
          labelClasses[tone],
        )}
      >
        {label}
      </div>
    </div>
  );
}

function ComplianceTabs({ data }: { data: ComplianceReportData }) {
  const locale = useCurrentLocale();
  const t = useI18n();

  return (
    <Tabs defaultValue="accessions" className="h-full flex flex-col">
      <TabsList className="grid w-full grid-cols-2 h-8 bg-muted/50">
        <ComplianceTabTrigger
          label={t("analytics.compliance.accessions")}
          pending={data.accessions.pending}
          value="accessions"
        />
        <ComplianceTabTrigger
          label={t("analytics.compliance.deaccessions")}
          pending={data.deaccessions.pending}
          value="deaccessions"
        />
      </TabsList>

      <TabsContent value="accessions" className="flex-1 mt-3">
        <ComplianceActivitySection
          locale={locale}
          pending={data.accessions.pending}
          pendingItems={data.accessions.pendingApprovals}
          recentItems={data.accessions.recentApprovals}
          type="accessions"
        />
      </TabsContent>
      <TabsContent value="deaccessions" className="flex-1 mt-3">
        <ComplianceActivitySection
          locale={locale}
          pending={data.deaccessions.pending}
          pendingItems={data.deaccessions.pendingApprovals}
          recentItems={data.deaccessions.recentApprovals}
          type="deaccessions"
        />
      </TabsContent>
    </Tabs>
  );
}

function ComplianceTabTrigger({
  label,
  pending,
  value,
}: {
  label: string;
  pending: number;
  value: ComplianceSectionType;
}) {
  return (
    <TabsTrigger value={value} className="text-xs h-7 gap-1">
      <ScrollText className="size-3" />
      {label}
      {pending > 0 && (
        <Badge
          variant="secondary"
          className="h-4 px-1 text-[9px] bg-amber-500/20 text-amber-500"
        >
          {pending}
        </Badge>
      )}
    </TabsTrigger>
  );
}

function ComplianceActivitySection({
  locale,
  pending,
  pendingItems,
  recentItems,
  type,
}: {
  locale: string;
  pending: number;
  pendingItems: PendingApproval[];
  recentItems: RecentApproval[];
  type: ComplianceSectionType;
}) {
  const t = useI18n();

  return (
    <div className="space-y-4">
      {pendingItems.length > 0 && (
        <PendingApprovalsTable
          items={pendingItems}
          locale={locale}
          pending={pending}
          type={type}
        />
      )}

      <div>
        <h4 className="text-xs font-semibold text-muted-foreground mb-2 flex items-center gap-1">
          <CheckCircle2 className="size-3" />
          {t("analytics.compliance.recentActivity")}
        </h4>
        <RecentApprovalsTable items={recentItems} type={type} />
      </div>
    </div>
  );
}

function PendingApprovalsTable({
  items,
  locale,
  pending,
  type,
}: {
  items: PendingApproval[];
  locale: string;
  pending: number;
  type: ComplianceSectionType;
}) {
  const t = useI18n();
  const isAccessions = type === "accessions";

  return (
    <div>
      <h4 className="text-xs font-semibold text-amber-500 mb-2 flex items-center gap-1">
        <Clock className="size-3" />
        {t("analytics.compliance.pending")} ({pending})
      </h4>
      <div className="rounded-md border border-amber-500/20 bg-amber-500/5 overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent border-amber-500/10 bg-amber-500/10">
              <TableHead className="h-7 text-[10px] uppercase font-semibold text-amber-400">
                {isAccessions
                  ? t("analytics.compliance.accessionNumber")
                  : t("analytics.compliance.deaccessionNumber")}
              </TableHead>
              <TableHead className="h-7 text-[10px] uppercase font-semibold text-amber-400">
                {isAccessions
                  ? t("analytics.compliance.source")
                  : t("analytics.compliance.reason")}
              </TableHead>
              <TableHead className="h-7 text-[10px] uppercase font-semibold text-amber-400 text-right">
                {t("analytics.compliance.received")}
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.slice(0, 5).map((item) => (
              <PendingApprovalRow
                item={item}
                key={item.id}
                locale={locale}
                type={type}
              />
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

function PendingApprovalRow({
  item,
  locale,
  type,
}: {
  item: PendingApproval;
  locale: string;
  type: ComplianceSectionType;
}) {
  const isAccessions = type === "accessions";
  const identifier = isAccessions
    ? "accessionNumber" in item
      ? item.accessionNumber
      : ""
    : "deaccessionNumber" in item
      ? item.deaccessionNumber
      : "";
  const detail = isAccessions
    ? "source" in item
      ? item.source
      : ""
    : "reason" in item
      ? item.reason
      : "";
  const timestamp = isAccessions
    ? "dateReceived" in item
      ? item.dateReceived
      : 0
    : "dateDeaccessioned" in item
      ? item.dateDeaccessioned
      : 0;

  return (
    <TableRow className="hover:bg-amber-500/10 border-amber-500/10">
      <TableCell className="font-mono text-xs font-medium">
        {identifier}
      </TableCell>
      <TableCell className="text-xs max-w-[100px] truncate" title={detail}>
        {detail}
      </TableCell>
      <TableCell className="text-xs text-right text-muted-foreground">
        {formatDateShort(timestamp, locale)}
      </TableCell>
    </TableRow>
  );
}

function RecentApprovalsTable({
  items,
  type,
}: {
  items: RecentApproval[];
  type: ComplianceSectionType;
}) {
  const t = useI18n();
  const isAccessions = type === "accessions";

  return (
    <div className="rounded-md border border-border bg-background/50 overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow className="hover:bg-transparent border-border bg-muted/30">
            <TableHead className="h-7 text-[10px] uppercase font-semibold">
              {isAccessions
                ? t("analytics.compliance.accessionNumber")
                : t("analytics.compliance.deaccessionNumber")}
            </TableHead>
            <TableHead className="h-7 text-[10px] uppercase font-semibold">
              {t("analytics.compliance.by")}
            </TableHead>
            <TableHead className="h-7 text-[10px] uppercase font-semibold text-right">
              {t("common.status")}
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {items.length === 0 ? (
            <TableRow>
              <TableCell
                colSpan={3}
                className="h-16 text-center text-xs text-muted-foreground"
              >
                {t("analytics.compliance.noRecentApprovals")}
              </TableCell>
            </TableRow>
          ) : (
            items
              .slice(0, 5)
              .map((item) => (
                <RecentApprovalRow item={item} key={item.id} type={type} />
              ))
          )}
        </TableBody>
      </Table>
    </div>
  );
}

function RecentApprovalRow({
  item,
  type,
}: {
  item: RecentApproval;
  type: ComplianceSectionType;
}) {
  const t = useI18n();
  const identifier =
    type === "accessions"
      ? "accessionNumber" in item
        ? item.accessionNumber
        : ""
      : "deaccessionNumber" in item
        ? item.deaccessionNumber
        : "";

  return (
    <TableRow className="hover:bg-muted/30 border-border">
      <TableCell className="font-mono text-xs font-medium">
        {identifier}
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
            ? t("analytics.compliance.status.approved")
            : t("analytics.compliance.status.rejected")}
        </Badge>
      </TableCell>
    </TableRow>
  );
}

export function ComplianceReportCard({ data }: ComplianceReportCardProps) {
  const t = useI18n();

  return (
    <Card className="bg-muted/30 border-white/10 backdrop-blur-sm h-full flex flex-col col-span-1 lg:col-span-2 xl:col-span-1">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium uppercase tracking-wider text-muted-foreground flex items-center gap-2">
          <FileCheck className="size-4" />
          {t("analytics.compliance.title")}
        </CardTitle>
        <ComplianceSummaryGrid data={data} />
      </CardHeader>
      <CardContent className="flex-1 overflow-auto pt-2">
        <ComplianceTabs data={data} />
      </CardContent>
    </Card>
  );
}
