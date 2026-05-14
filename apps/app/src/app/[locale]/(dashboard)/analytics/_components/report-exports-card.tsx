"use client";

import { formatDate as formatDateUtil } from "@/lib/format-date";
import { formatCurrency as formatCurrencyUtil } from "@/lib/format-number";
import { useCurrentLocale, useScopedI18n } from "@/locales/client";
import { Button } from "@v1/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@v1/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@v1/ui/dropdown-menu";
import {
  Download,
  FileSpreadsheet,
  FileText,
  Loader2,
  Package,
} from "lucide-react";
import { useCallback, useState } from "react";

interface ReportExportsCardProps {
  kpis: {
    inventory: {
      totalValue: number;
      fineArt: {
        totalValue: number;
        itemCount: number;
        valuedCount: number;
      };
      wine: {
        totalValue: number;
        itemCount: number;
        valuedCount: number;
      };
      vehicles: {
        totalValue: number;
        itemCount: number;
        valuedCount: number;
      };
    };
    loans: {
      overdue: number;
      dueToday: number;
      dueNext7Days: number;
      dueNext30Days: number;
      upcomingReturns: Array<{
        loanNumber: string;
        lenderBorrowerName: string;
        type: "incoming" | "outgoing";
        endDate: number;
        daysRemaining: number;
        status: string;
      }>;
    };
    exhibitions: {
      proposed: number;
      approved: number;
      active: number;
      closed: number;
      rejected: number;
    };
    generatedAt: number;
  };
  compliance?: {
    accessions: {
      total: number;
      pending: number;
      approved: number;
      rejected: number;
      pendingApprovals: Array<{
        accessionNumber: string;
        source: string;
        dateReceived: number;
        method: string;
      }>;
      recentApprovals: Array<{
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
      recentApprovals: Array<{
        deaccessionNumber: string;
        reason: string;
        approvedAt: number;
        approvedByName: string;
        status: string;
        proceedsAmount?: number;
      }>;
    };
    auditTrail: {
      totalEvents: number;
      recentEvents: Array<{
        action: string;
        entityType: string;
        userName: string;
        timestamp: number;
      }>;
    };
  };
  locationUtilization: {
    summary: {
      totalLocations: number;
      locationsWithCapacity: number;
      totalCapacity: number;
      totalOccupied: number;
      utilizationPercentage: number;
    };
    byType: Array<{
      type: string;
      count: number;
      totalCapacity: number;
      totalOccupied: number;
      utilizationPercentage: number;
    }>;
    topUtilized: Array<{
      name: string;
      type: string;
      capacity: number;
      occupied: number;
      utilizationPercentage: number;
      path: string;
    }>;
    atCapacity: Array<{
      name: string;
      type: string;
      capacity: number;
      occupied: number;
      path: string;
    }>;
  };
}

function formatDate(timestamp: number, locale: string): string {
  return formatDateUtil(new Date(timestamp), locale, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function formatCurrency(
  value: number,
  locale: "en" | "fr" | "es" | "no" | "ro",
): string {
  return formatCurrencyUtil(value, locale, "USD").replace(/\.\d+$/, "");
}

function downloadCSV(filename: string, csvContent: string) {
  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const link = document.createElement("a");
  const url = URL.createObjectURL(blob);
  link.setAttribute("href", url);
  link.setAttribute("download", filename);
  link.style.visibility = "hidden";
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

function escapeCSV(value: string | number | undefined): string {
  if (value === undefined || value === null) return "";
  const str = String(value);
  if (str.includes(",") || str.includes('"') || str.includes("\n")) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

export function ReportExportsCard({
  kpis,
  compliance,
  locationUtilization,
}: ReportExportsCardProps) {
  const locale = useCurrentLocale();
  const t = useScopedI18n("analytics.reportExports");
  const csv = useScopedI18n("analytics.reportExports.csv");
  const [exporting, setExporting] = useState<string | null>(null);
  const hasCompliance = Boolean(compliance);

  const exportInventoryValuation = useCallback(() => {
    setExporting("inventory");
    try {
      const rows = [
        [csv("inventory.title")],
        [`${csv("generated")}: ${formatDate(kpis.generatedAt, locale)}`],
        [],
        [
          csv("inventory.category"),
          csv("inventory.itemCount"),
          csv("inventory.valuedItems"),
          csv("inventory.totalValue"),
        ],
        [
          csv("inventory.fineArt"),
          kpis.inventory.fineArt.itemCount,
          kpis.inventory.fineArt.valuedCount,
          kpis.inventory.fineArt.totalValue,
        ],
        [
          csv("inventory.wineSpirits"),
          kpis.inventory.wine.itemCount,
          kpis.inventory.wine.valuedCount,
          kpis.inventory.wine.totalValue,
        ],
        [
          csv("inventory.vehicles"),
          kpis.inventory.vehicles.itemCount,
          kpis.inventory.vehicles.valuedCount,
          kpis.inventory.vehicles.totalValue,
        ],
        [],
        [csv("total"), "", "", kpis.inventory.totalValue],
      ];

      const csvContent = rows
        .map((row) => row.map(escapeCSV).join(","))
        .join("\n");
      downloadCSV(
        `inventory-valuation-${new Date().toISOString().split("T")[0]}.csv`,
        csvContent,
      );
    } finally {
      setExporting(null);
    }
  }, [kpis, csv, locale]);

  const exportLoanReport = useCallback(() => {
    setExporting("loans");
    try {
      const rows = [
        [csv("loans.title")],
        [`${csv("generated")}: ${formatDate(kpis.generatedAt, locale)}`],
        [],
        [csv("loans.statusSummary")],
        [csv("loans.overdue"), kpis.loans.overdue],
        [csv("loans.dueToday"), kpis.loans.dueToday],
        [csv("loans.dueIn7Days"), kpis.loans.dueNext7Days],
        [csv("loans.dueIn30Days"), kpis.loans.dueNext30Days],
        [],
        [csv("loans.upcomingReturns")],
        [
          csv("loans.loanNumber"),
          csv("loans.partner"),
          csv("loans.type"),
          csv("loans.endDate"),
          csv("loans.daysRemaining"),
          csv("loans.status"),
        ],
        ...kpis.loans.upcomingReturns.map((loan) => [
          loan.loanNumber,
          loan.lenderBorrowerName,
          loan.type,
          formatDate(loan.endDate, locale),
          loan.daysRemaining,
          loan.status,
        ]),
      ];

      const csvContent = rows
        .map((row) => row.map(escapeCSV).join(","))
        .join("\n");
      downloadCSV(
        `loan-report-${new Date().toISOString().split("T")[0]}.csv`,
        csvContent,
      );
    } finally {
      setExporting(null);
    }
  }, [kpis, csv, locale]);

  const exportComplianceReport = useCallback(() => {
    if (!compliance) return;

    setExporting("compliance");
    try {
      const rows = [
        [csv("compliance.title")],
        [`${csv("generated")}: ${formatDate(kpis.generatedAt, locale)}`],
        [],
        [csv("compliance.accessionSummary")],
        [csv("compliance.total"), compliance.accessions.total],
        [csv("compliance.pending"), compliance.accessions.pending],
        [csv("compliance.approved"), compliance.accessions.approved],
        [csv("compliance.rejected"), compliance.accessions.rejected],
        [],
        [csv("compliance.pendingAccessionApprovals")],
        [
          csv("compliance.accessionNumber"),
          csv("compliance.source"),
          csv("compliance.dateReceived"),
          csv("compliance.method"),
        ],
        ...compliance.accessions.pendingApprovals.map((a) => [
          a.accessionNumber,
          a.source,
          formatDate(a.dateReceived, locale),
          a.method,
        ]),
        [],
        [csv("compliance.recentAccessionActivity")],
        [
          csv("compliance.accessionNumber"),
          csv("compliance.source"),
          csv("compliance.approvedAt"),
          csv("compliance.approvedBy"),
          csv("compliance.status"),
        ],
        ...compliance.accessions.recentApprovals.map((a) => [
          a.accessionNumber,
          a.source,
          formatDate(a.approvedAt, locale),
          a.approvedByName,
          a.status,
        ]),
        [],
        [csv("compliance.deaccessionSummary")],
        [csv("compliance.total"), compliance.deaccessions.total],
        [csv("compliance.pending"), compliance.deaccessions.pending],
        [csv("compliance.approved"), compliance.deaccessions.approved],
        [csv("compliance.rejected"), compliance.deaccessions.rejected],
        [],
        [csv("compliance.recentDeaccessionActivity")],
        [
          csv("compliance.deaccessionNumber"),
          csv("compliance.reason"),
          csv("compliance.approvedAt"),
          csv("compliance.approvedBy"),
          csv("compliance.status"),
          csv("compliance.proceeds"),
        ],
        ...compliance.deaccessions.recentApprovals.map((d) => [
          d.deaccessionNumber,
          d.reason,
          formatDate(d.approvedAt, locale),
          d.approvedByName,
          d.status,
          d.proceedsAmount ?? "",
        ]),
        [],
        [csv("compliance.auditTrail")],
        [
          csv("compliance.action"),
          csv("compliance.entityType"),
          csv("compliance.user"),
          csv("compliance.timestamp"),
        ],
        ...compliance.auditTrail.recentEvents.map((e) => [
          e.action,
          e.entityType,
          e.userName,
          formatDate(e.timestamp, locale),
        ]),
      ];

      const csvContent = rows
        .map((row) => row.map(escapeCSV).join(","))
        .join("\n");
      downloadCSV(
        `compliance-report-${new Date().toISOString().split("T")[0]}.csv`,
        csvContent,
      );
    } finally {
      setExporting(null);
    }
  }, [compliance, kpis.generatedAt, csv, locale]);

  const exportLocationReport = useCallback(() => {
    setExporting("locations");
    try {
      const rows = [
        [csv("location.title")],
        [`${csv("generated")}: ${formatDate(kpis.generatedAt, locale)}`],
        [],
        [csv("location.summary")],
        [
          csv("location.totalLocations"),
          locationUtilization.summary.totalLocations,
        ],
        [
          csv("location.locationsWithCapacity"),
          locationUtilization.summary.locationsWithCapacity,
        ],
        [
          csv("location.totalCapacity"),
          locationUtilization.summary.totalCapacity,
        ],
        [
          csv("location.totalOccupied"),
          locationUtilization.summary.totalOccupied,
        ],
        [
          csv("location.overallUtilization"),
          `${locationUtilization.summary.utilizationPercentage}%`,
        ],
        [],
        [csv("location.utilizationByType")],
        [
          csv("location.type"),
          csv("location.count"),
          csv("location.capacity"),
          csv("location.occupied"),
          csv("location.utilizationPercent"),
        ],
        ...locationUtilization.byType.map((item) => [
          item.type,
          item.count,
          item.totalCapacity,
          item.totalOccupied,
          `${item.utilizationPercentage}%`,
        ]),
        [],
        [csv("location.topUtilizedLocations")],
        [
          csv("location.name"),
          csv("location.type"),
          csv("location.path"),
          csv("location.capacity"),
          csv("location.occupied"),
          csv("location.utilizationPercent"),
        ],
        ...locationUtilization.topUtilized.map((loc) => [
          loc.name,
          loc.type,
          loc.path,
          loc.capacity,
          loc.occupied,
          `${loc.utilizationPercentage}%`,
        ]),
        [],
        [csv("location.locationsAtCapacity")],
        [
          csv("location.name"),
          csv("location.type"),
          csv("location.path"),
          csv("location.capacity"),
          csv("location.occupied"),
        ],
        ...locationUtilization.atCapacity.map((loc) => [
          loc.name,
          loc.type,
          loc.path,
          loc.capacity,
          loc.occupied,
        ]),
      ];

      const csvContent = rows
        .map((row) => row.map(escapeCSV).join(","))
        .join("\n");
      downloadCSV(
        `location-utilization-${new Date().toISOString().split("T")[0]}.csv`,
        csvContent,
      );
    } finally {
      setExporting(null);
    }
  }, [locationUtilization, kpis.generatedAt, csv, locale]);

  const exportAllReports = useCallback(() => {
    exportInventoryValuation();
    setTimeout(() => exportLoanReport(), 100);
    setTimeout(() => exportComplianceReport(), 200);
    setTimeout(() => exportLocationReport(), 300);
  }, [
    exportInventoryValuation,
    exportLoanReport,
    exportComplianceReport,
    exportLocationReport,
  ]);

  const exportBoardReport = useCallback(() => {
    setExporting("board");
    try {
      const complianceRows = compliance
        ? [
            [csv("board.accessionDeaccessionActivity")],
            [csv("board.totalAccessions"), compliance.accessions.total],
            [csv("board.pendingApproval"), compliance.accessions.pending],
            [csv("board.totalDeaccessions"), compliance.deaccessions.total],
            [csv("board.pendingApproval"), compliance.deaccessions.pending],
            [],
          ]
        : [
            [csv("board.accessionDeaccessionActivity")],
            [csv("upgradeToEnterprise")],
            [],
          ];

      const rows = [
        [csv("board.title")],
        [`${csv("generated")}: ${formatDate(kpis.generatedAt, locale)}`],
        [],
        [csv("board.collectionValuation")],
        [csv("board.category"), csv("board.items"), csv("board.totalValue")],
        [
          csv("board.fineArt"),
          kpis.inventory.fineArt.itemCount.toString(),
          formatCurrency(kpis.inventory.fineArt.totalValue, locale),
        ],
        [
          csv("board.wine"),
          kpis.inventory.wine.itemCount.toString(),
          formatCurrency(kpis.inventory.wine.totalValue, locale),
        ],
        [
          csv("board.vehicles"),
          kpis.inventory.vehicles.itemCount.toString(),
          formatCurrency(kpis.inventory.vehicles.totalValue, locale),
        ],
        [csv("total"), "", formatCurrency(kpis.inventory.totalValue, locale)],
        [],
        [csv("board.loanStatus")],
        [csv("board.overdueLoans"), kpis.loans.overdue],
        [csv("board.dueToday"), kpis.loans.dueToday],
        [csv("board.dueNext7Days"), kpis.loans.dueNext7Days],
        [csv("board.dueNext30Days"), kpis.loans.dueNext30Days],
        [],
        [csv("board.exhibitionStatus")],
        [csv("board.proposed"), kpis.exhibitions.proposed],
        [csv("board.approved"), kpis.exhibitions.approved],
        [csv("board.active"), kpis.exhibitions.active],
        [csv("board.closed"), kpis.exhibitions.closed],
        [],
        ...complianceRows,
        [csv("board.storageUtilization")],
        [
          csv("location.totalCapacity"),
          locationUtilization.summary.totalCapacity,
        ],
        [
          csv("board.currentlyOccupied"),
          locationUtilization.summary.totalOccupied,
        ],
        [
          csv("board.utilizationRate"),
          `${locationUtilization.summary.utilizationPercentage}%`,
        ],
        [
          csv("board.locationsAtCapacity"),
          locationUtilization.atCapacity.length,
        ],
      ];

      const csvContent = rows
        .map((row) => row.map(escapeCSV).join(","))
        .join("\n");
      downloadCSV(
        `board-summary-${new Date().toISOString().split("T")[0]}.csv`,
        csvContent,
      );
    } finally {
      setExporting(null);
    }
  }, [kpis, compliance, locationUtilization, csv, locale]);

  const exportInsuranceReport = useCallback(() => {
    setExporting("insurance");
    try {
      const rows = [
        [csv("insurance.title")],
        [`${csv("generated")}: ${formatDate(kpis.generatedAt, locale)}`],
        [],
        [csv("insurance.collectionValuationSummary")],
        [
          csv("insurance.category"),
          csv("insurance.itemCount"),
          csv("insurance.valuedItems"),
          csv("insurance.insuranceValue"),
        ],
        [
          csv("insurance.fineArt"),
          kpis.inventory.fineArt.itemCount,
          kpis.inventory.fineArt.valuedCount,
          formatCurrency(
            kpis.inventory.fineArt.totalValue,
            locale as "en" | "fr" | "es" | "no",
          ),
        ],
        [
          csv("insurance.wineSpirits"),
          kpis.inventory.wine.itemCount,
          kpis.inventory.wine.valuedCount,
          formatCurrency(
            kpis.inventory.wine.totalValue,
            locale as "en" | "fr" | "es" | "no",
          ),
        ],
        [
          csv("insurance.vehicles"),
          kpis.inventory.vehicles.itemCount,
          kpis.inventory.vehicles.valuedCount,
          formatCurrency(
            kpis.inventory.vehicles.totalValue,
            locale as "en" | "fr" | "es" | "no",
          ),
        ],
        [],
        [
          csv("insurance.totalInsurableValue"),
          "",
          "",
          formatCurrency(
            kpis.inventory.totalValue,
            locale as "en" | "fr" | "es" | "no",
          ),
        ],
        [],
        [csv("insurance.itemsOnLoan")],
        [
          csv("insurance.loanNumber"),
          csv("insurance.partner"),
          csv("insurance.type"),
          csv("insurance.endDate"),
          csv("insurance.status"),
        ],
        ...kpis.loans.upcomingReturns.map((loan) => [
          loan.loanNumber,
          loan.lenderBorrowerName,
          loan.type,
          formatDate(loan.endDate, locale),
          loan.status,
        ]),
        [],
        [csv("insurance.storageConditions")],
        [
          csv("insurance.locationType"),
          csv("insurance.totalCapacity"),
          csv("insurance.currentOccupancy"),
          csv("insurance.utilization"),
        ],
        ...locationUtilization.byType.map((item) => [
          item.type,
          item.totalCapacity,
          item.totalOccupied,
          `${item.utilizationPercentage}%`,
        ]),
      ];

      const csvContent = rows
        .map((row) => row.map(escapeCSV).join(","))
        .join("\n");
      downloadCSV(
        `insurance-report-${new Date().toISOString().split("T")[0]}.csv`,
        csvContent,
      );
    } finally {
      setExporting(null);
    }
  }, [kpis, locationUtilization, csv, locale]);

  return (
    <Card className="bg-muted/30 border-white/10 backdrop-blur-sm">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-medium uppercase tracking-wider text-muted-foreground flex items-center justify-between">
          <span className="flex items-center gap-2">
            <Download className="size-4" />
            {t("title")}
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex flex-wrap gap-2">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="gap-2">
                {exporting === "board" ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <FileText className="size-4" />
                )}
                {t("boardReport")}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start">
              <DropdownMenuItem onClick={exportBoardReport}>
                <FileSpreadsheet className="size-4 mr-2" />
                {t("exportAsCSV")}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="gap-2">
                {exporting === "insurance" ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <Package className="size-4" />
                )}
                {t("insuranceReport")}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start">
              <DropdownMenuItem onClick={exportInsuranceReport}>
                <FileSpreadsheet className="size-4 mr-2" />
                {t("exportAsCSV")}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="gap-2">
                <FileSpreadsheet className="size-4" />
                {t("individualReports")}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start">
              <DropdownMenuItem onClick={exportInventoryValuation}>
                {t("inventoryValuation")}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={exportLoanReport}>
                {t("loanStatusReport")}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={exportComplianceReport}>
                {t("complianceAudit")}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={exportLocationReport}>
                {t("locationUtilization")}
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={exportAllReports}>
                {t("exportAllReports")}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </CardContent>
    </Card>
  );
}
