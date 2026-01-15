"use client";

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

function formatDate(timestamp: number): string {
  return new Date(timestamp).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(value);
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
  const [exporting, setExporting] = useState<string | null>(null);
  const hasCompliance = Boolean(compliance);

  const exportInventoryValuation = useCallback(() => {
    setExporting("inventory");
    try {
      const rows = [
        ["Inventory Valuation Report"],
        [`Generated: ${formatDate(kpis.generatedAt)}`],
        [],
        ["Category", "Item Count", "Valued Items", "Total Value"],
        [
          "Fine Art",
          kpis.inventory.fineArt.itemCount,
          kpis.inventory.fineArt.valuedCount,
          kpis.inventory.fineArt.totalValue,
        ],
        [
          "Wine & Spirits",
          kpis.inventory.wine.itemCount,
          kpis.inventory.wine.valuedCount,
          kpis.inventory.wine.totalValue,
        ],
        [
          "Vehicles",
          kpis.inventory.vehicles.itemCount,
          kpis.inventory.vehicles.valuedCount,
          kpis.inventory.vehicles.totalValue,
        ],
        [],
        ["TOTAL", "", "", kpis.inventory.totalValue],
      ];

      const csv = rows.map((row) => row.map(escapeCSV).join(",")).join("\n");
      downloadCSV(
        `inventory-valuation-${new Date().toISOString().split("T")[0]}.csv`,
        csv,
      );
    } finally {
      setExporting(null);
    }
  }, [kpis]);

  const exportLoanReport = useCallback(() => {
    setExporting("loans");
    try {
      const rows = [
        ["Loan Status Report"],
        [`Generated: ${formatDate(kpis.generatedAt)}`],
        [],
        ["Status Summary"],
        ["Overdue", kpis.loans.overdue],
        ["Due Today", kpis.loans.dueToday],
        ["Due in 7 Days", kpis.loans.dueNext7Days],
        ["Due in 30 Days", kpis.loans.dueNext30Days],
        [],
        ["Upcoming Returns"],
        [
          "Loan Number",
          "Partner",
          "Type",
          "End Date",
          "Days Remaining",
          "Status",
        ],
        ...kpis.loans.upcomingReturns.map((loan) => [
          loan.loanNumber,
          loan.lenderBorrowerName,
          loan.type,
          formatDate(loan.endDate),
          loan.daysRemaining,
          loan.status,
        ]),
      ];

      const csv = rows.map((row) => row.map(escapeCSV).join(",")).join("\n");
      downloadCSV(
        `loan-report-${new Date().toISOString().split("T")[0]}.csv`,
        csv,
      );
    } finally {
      setExporting(null);
    }
  }, [kpis]);

  const exportComplianceReport = useCallback(() => {
    if (!compliance) return;

    setExporting("compliance");
    try {
      const rows = [
        ["Compliance & Audit Report"],
        [`Generated: ${formatDate(kpis.generatedAt)}`],
        [],
        ["Accession Summary"],
        ["Total", compliance.accessions.total],
        ["Pending", compliance.accessions.pending],
        ["Approved", compliance.accessions.approved],
        ["Rejected", compliance.accessions.rejected],
        [],
        ["Pending Accession Approvals"],
        ["Accession #", "Source", "Date Received", "Method"],
        ...compliance.accessions.pendingApprovals.map((a) => [
          a.accessionNumber,
          a.source,
          formatDate(a.dateReceived),
          a.method,
        ]),
        [],
        ["Recent Accession Activity"],
        ["Accession #", "Source", "Approved At", "Approved By", "Status"],
        ...compliance.accessions.recentApprovals.map((a) => [
          a.accessionNumber,
          a.source,
          formatDate(a.approvedAt),
          a.approvedByName,
          a.status,
        ]),
        [],
        ["Deaccession Summary"],
        ["Total", compliance.deaccessions.total],
        ["Pending", compliance.deaccessions.pending],
        ["Approved", compliance.deaccessions.approved],
        ["Rejected", compliance.deaccessions.rejected],
        [],
        ["Recent Deaccession Activity"],
        [
          "Deaccession #",
          "Reason",
          "Approved At",
          "Approved By",
          "Status",
          "Proceeds",
        ],
        ...compliance.deaccessions.recentApprovals.map((d) => [
          d.deaccessionNumber,
          d.reason,
          formatDate(d.approvedAt),
          d.approvedByName,
          d.status,
          d.proceedsAmount ?? "",
        ]),
        [],
        ["Audit Trail (Recent Events)"],
        ["Action", "Entity Type", "User", "Timestamp"],
        ...compliance.auditTrail.recentEvents.map((e) => [
          e.action,
          e.entityType,
          e.userName,
          formatDate(e.timestamp),
        ]),
      ];

      const csv = rows.map((row) => row.map(escapeCSV).join(",")).join("\n");
      downloadCSV(
        `compliance-report-${new Date().toISOString().split("T")[0]}.csv`,
        csv,
      );
    } finally {
      setExporting(null);
    }
  }, [compliance, kpis.generatedAt]);

  const exportLocationReport = useCallback(() => {
    setExporting("locations");
    try {
      const rows = [
        ["Location Utilization Report"],
        [`Generated: ${formatDate(kpis.generatedAt)}`],
        [],
        ["Summary"],
        ["Total Locations", locationUtilization.summary.totalLocations],
        [
          "Locations with Capacity Tracking",
          locationUtilization.summary.locationsWithCapacity,
        ],
        ["Total Capacity", locationUtilization.summary.totalCapacity],
        ["Total Occupied", locationUtilization.summary.totalOccupied],
        [
          "Overall Utilization",
          `${locationUtilization.summary.utilizationPercentage}%`,
        ],
        [],
        ["Utilization by Type"],
        ["Type", "Count", "Capacity", "Occupied", "Utilization %"],
        ...locationUtilization.byType.map((t) => [
          t.type,
          t.count,
          t.totalCapacity,
          t.totalOccupied,
          `${t.utilizationPercentage}%`,
        ]),
        [],
        ["Top Utilized Locations"],
        ["Name", "Type", "Path", "Capacity", "Occupied", "Utilization %"],
        ...locationUtilization.topUtilized.map((loc) => [
          loc.name,
          loc.type,
          loc.path,
          loc.capacity,
          loc.occupied,
          `${loc.utilizationPercentage}%`,
        ]),
        [],
        ["Locations at Capacity"],
        ["Name", "Type", "Path", "Capacity", "Occupied"],
        ...locationUtilization.atCapacity.map((loc) => [
          loc.name,
          loc.type,
          loc.path,
          loc.capacity,
          loc.occupied,
        ]),
      ];

      const csv = rows.map((row) => row.map(escapeCSV).join(",")).join("\n");
      downloadCSV(
        `location-utilization-${new Date().toISOString().split("T")[0]}.csv`,
        csv,
      );
    } finally {
      setExporting(null);
    }
  }, [locationUtilization, kpis.generatedAt]);

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
            ["ACCESSION/DEACCESSION ACTIVITY"],
            ["Total Accessions", compliance.accessions.total],
            ["Pending Approval", compliance.accessions.pending],
            ["Total Deaccessions", compliance.deaccessions.total],
            ["Pending Approval", compliance.deaccessions.pending],
            [],
          ]
        : [["ACCESSION/DEACCESSION ACTIVITY"], ["Upgrade to Enterprise"], []];

      const rows = [
        ["Board Summary Report"],
        [`Generated: ${formatDate(kpis.generatedAt)}`],
        [],
        ["COLLECTION VALUATION"],
        ["Category", "Items", "Total Value"],
        [
          "Fine Art",
          kpis.inventory.fineArt.itemCount,
          formatCurrency(kpis.inventory.fineArt.totalValue),
        ],
        [
          "Wine & Spirits",
          kpis.inventory.wine.itemCount,
          formatCurrency(kpis.inventory.wine.totalValue),
        ],
        [
          "Vehicles",
          kpis.inventory.vehicles.itemCount,
          formatCurrency(kpis.inventory.vehicles.totalValue),
        ],
        ["TOTAL", "", formatCurrency(kpis.inventory.totalValue)],
        [],
        ["LOAN STATUS"],
        ["Overdue Loans", kpis.loans.overdue],
        ["Due Today", kpis.loans.dueToday],
        ["Due Next 7 Days", kpis.loans.dueNext7Days],
        ["Due Next 30 Days", kpis.loans.dueNext30Days],
        [],
        ["EXHIBITION STATUS"],
        ["Proposed", kpis.exhibitions.proposed],
        ["Approved", kpis.exhibitions.approved],
        ["Active", kpis.exhibitions.active],
        ["Closed", kpis.exhibitions.closed],
        [],
        ...complianceRows,
        ["STORAGE UTILIZATION"],
        ["Total Capacity", locationUtilization.summary.totalCapacity],
        ["Currently Occupied", locationUtilization.summary.totalOccupied],
        [
          "Utilization Rate",
          `${locationUtilization.summary.utilizationPercentage}%`,
        ],
        ["Locations at Capacity", locationUtilization.atCapacity.length],
      ];

      const csv = rows.map((row) => row.map(escapeCSV).join(",")).join("\n");
      downloadCSV(
        `board-summary-${new Date().toISOString().split("T")[0]}.csv`,
        csv,
      );
    } finally {
      setExporting(null);
    }
  }, [kpis, compliance, locationUtilization]);

  const exportInsuranceReport = useCallback(() => {
    setExporting("insurance");
    try {
      const rows = [
        ["Insurance Valuation Report"],
        [`Generated: ${formatDate(kpis.generatedAt)}`],
        [],
        ["COLLECTION VALUATION SUMMARY"],
        ["Category", "Item Count", "Valued Items", "Insurance Value"],
        [
          "Fine Art",
          kpis.inventory.fineArt.itemCount,
          kpis.inventory.fineArt.valuedCount,
          formatCurrency(kpis.inventory.fineArt.totalValue),
        ],
        [
          "Wine & Spirits",
          kpis.inventory.wine.itemCount,
          kpis.inventory.wine.valuedCount,
          formatCurrency(kpis.inventory.wine.totalValue),
        ],
        [
          "Vehicles",
          kpis.inventory.vehicles.itemCount,
          kpis.inventory.vehicles.valuedCount,
          formatCurrency(kpis.inventory.vehicles.totalValue),
        ],
        [],
        [
          "TOTAL INSURABLE VALUE",
          "",
          "",
          formatCurrency(kpis.inventory.totalValue),
        ],
        [],
        ["ITEMS ON LOAN (POTENTIAL EXPOSURE)"],
        ["Loan #", "Partner", "Type", "End Date", "Status"],
        ...kpis.loans.upcomingReturns.map((loan) => [
          loan.loanNumber,
          loan.lenderBorrowerName,
          loan.type,
          formatDate(loan.endDate),
          loan.status,
        ]),
        [],
        ["STORAGE CONDITIONS"],
        ["Location Type", "Total Capacity", "Current Occupancy", "Utilization"],
        ...locationUtilization.byType.map((t) => [
          t.type,
          t.totalCapacity,
          t.totalOccupied,
          `${t.utilizationPercentage}%`,
        ]),
      ];

      const csv = rows.map((row) => row.map(escapeCSV).join(",")).join("\n");
      downloadCSV(
        `insurance-report-${new Date().toISOString().split("T")[0]}.csv`,
        csv,
      );
    } finally {
      setExporting(null);
    }
  }, [kpis, locationUtilization]);

  return (
    <Card className="bg-muted/30 border-white/10 backdrop-blur-sm">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-medium uppercase tracking-wider text-muted-foreground flex items-center justify-between">
          <span className="flex items-center gap-2">
            <Download className="w-4 h-4" />
            Report Exports
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex flex-wrap gap-2">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="gap-2">
                {exporting === "board" ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <FileText className="w-4 h-4" />
                )}
                Board Report
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start">
              <DropdownMenuItem onClick={exportBoardReport}>
                <FileSpreadsheet className="w-4 h-4 mr-2" />
                Export as CSV
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="gap-2">
                {exporting === "insurance" ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Package className="w-4 h-4" />
                )}
                Insurance Report
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start">
              <DropdownMenuItem onClick={exportInsuranceReport}>
                <FileSpreadsheet className="w-4 h-4 mr-2" />
                Export as CSV
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="gap-2">
                <FileSpreadsheet className="w-4 h-4" />
                Individual Reports
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start">
              <DropdownMenuItem onClick={exportInventoryValuation}>
                Inventory Valuation
              </DropdownMenuItem>
              <DropdownMenuItem onClick={exportLoanReport}>
                Loan Status
              </DropdownMenuItem>
              <DropdownMenuItem onClick={exportComplianceReport}>
                Compliance & Audit
              </DropdownMenuItem>
              <DropdownMenuItem onClick={exportLocationReport}>
                Location Utilization
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={exportAllReports}>
                Export All Reports
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </CardContent>
    </Card>
  );
}
