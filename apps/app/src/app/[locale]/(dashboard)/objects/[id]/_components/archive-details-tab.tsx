"use client";

import { api } from "@v1/backend/convex/_generated/api";
import type { Id } from "@v1/backend/convex/_generated/dataModel";
import { Button } from "@v1/ui/button";
import { cn } from "@v1/ui/utils";
import { useQuery } from "convex/react";
import {
  FileText,
  Calendar,
  Shield,
  AlertTriangle,
  Trash2,
  Lock,
  Clock,
  Plus,
} from "lucide-react";
import { format } from "date-fns";

interface ArchiveDetailsTabProps {
  collectionId: string;
  organizationId: Id<"organizations">;
}

export function ArchiveDetailsTab({
  collectionId,
  organizationId,
}: ArchiveDetailsTabProps) {
  const details = useQuery(api.archiveDetails.get, {
    collectionId: collectionId as Id<"collections">,
  });

  if (details === undefined) {
    return (
      <div className="flex h-32 items-center justify-center">
        <p className="text-sm text-muted-foreground">
          Loading archive details...
        </p>
      </div>
    );
  }

  if (details === null) {
    return (
      <div className="space-y-6">
        <div className="flex h-32 flex-col items-center justify-center gap-4 rounded-xl border border-dashed border-border">
          <p className="text-sm text-muted-foreground">
            No archive details recorded yet
          </p>
          <Button variant="outline" size="sm">
            <Plus className="mr-2 h-4 w-4" />
            Add Archive Details
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-xl border border-border/60 bg-secondary/20 p-4">
          <div className="mb-2 flex items-center gap-2">
            <FileText className="h-4 w-4 text-blue-500" />
            <span className="text-[10px] font-medium uppercase tracking-widest text-muted-foreground">
              Document Type
            </span>
          </div>
          <span className="text-sm font-medium text-foreground">
            {details.documentType || "—"}
          </span>
          {details.recordSeries && (
            <p className="mt-1 text-xs text-muted-foreground">
              {details.recordSeries}
            </p>
          )}
        </div>

        <div className="rounded-xl border border-border/60 bg-secondary/20 p-4">
          <div className="mb-2 flex items-center gap-2">
            <Shield className="h-4 w-4 text-purple-500" />
            <span className="text-[10px] font-medium uppercase tracking-widest text-muted-foreground">
              Confidentiality
            </span>
          </div>
          <span
            className={cn(
              "inline-flex rounded px-2 py-0.5 text-xs font-medium",
              details.confidentialityLevel === "public"
                ? "bg-emerald-500/10 text-emerald-500"
                : details.confidentialityLevel === "internal"
                  ? "bg-blue-500/10 text-blue-500"
                  : details.confidentialityLevel === "confidential"
                    ? "bg-amber-500/10 text-amber-500"
                    : details.confidentialityLevel === "restricted"
                      ? "bg-orange-500/10 text-orange-500"
                      : details.confidentialityLevel === "top_secret"
                        ? "bg-red-500/10 text-red-500"
                        : "bg-secondary text-muted-foreground",
            )}
          >
            {details.confidentialityLevel?.replace(/_/g, " ") ||
              "Not classified"}
          </span>
        </div>

        <div className="rounded-xl border border-border/60 bg-secondary/20 p-4">
          <div className="mb-2 flex items-center gap-2">
            <Clock className="h-4 w-4 text-cyan-500" />
            <span className="text-[10px] font-medium uppercase tracking-widest text-muted-foreground">
              Retention
            </span>
          </div>
          <span className="text-sm font-medium text-foreground">
            {details.retentionYears ? `${details.retentionYears} years` : "—"}
          </span>
          {details.retentionExpiresAt && (
            <p className="mt-1 text-xs text-muted-foreground">
              Expires:{" "}
              {format(new Date(details.retentionExpiresAt), "MMM d, yyyy")}
            </p>
          )}
        </div>

        <div className="rounded-xl border border-border/60 bg-secondary/20 p-4">
          <div className="mb-2 flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-amber-500" />
            <span className="text-[10px] font-medium uppercase tracking-widest text-muted-foreground">
              Status
            </span>
          </div>
          <div className="space-y-1">
            {details.legalHold && (
              <span className="inline-flex rounded px-1.5 py-0.5 text-[10px] font-medium bg-red-500/10 text-red-500">
                Legal Hold
              </span>
            )}
            {details.flaggedForDestruction && (
              <span className="inline-flex rounded px-1.5 py-0.5 text-[10px] font-medium bg-orange-500/10 text-orange-500 ml-1">
                Flagged for Destruction
              </span>
            )}
            {!details.legalHold && !details.flaggedForDestruction && (
              <span className="text-xs text-muted-foreground">Active</span>
            )}
          </div>
        </div>
      </div>

      {details.legalHold && (
        <div className="rounded-lg border border-red-500/30 bg-red-500/5 p-4">
          <div className="flex items-center gap-2">
            <Lock className="h-4 w-4 text-red-500" />
            <span className="text-sm font-medium text-red-500">
              Legal Hold Active
            </span>
          </div>
          {details.legalHoldReason && (
            <p className="mt-2 text-sm text-red-500/80">
              Reason: {details.legalHoldReason}
            </p>
          )}
        </div>
      )}

      {details.flaggedForDestruction && (
        <div className="rounded-lg border border-orange-500/30 bg-orange-500/5 p-4">
          <div className="flex items-center gap-2">
            <Trash2 className="h-4 w-4 text-orange-500" />
            <span className="text-sm font-medium text-orange-500">
              Flagged for Destruction
            </span>
          </div>
          {details.destructionDate && (
            <p className="mt-1 text-sm text-orange-500/80">
              Scheduled:{" "}
              {format(new Date(details.destructionDate), "MMMM d, yyyy")}
            </p>
          )}
          {details.destructionMethod && (
            <p className="mt-1 text-sm text-orange-500/80">
              Method: {details.destructionMethod}
            </p>
          )}
        </div>
      )}

      <div>
        <h3 className="mb-4 flex items-center gap-2 text-xs font-medium text-foreground">
          <FileText className="h-4 w-4 text-blue-500" />
          Document Information
        </h3>

        <div className="rounded-lg border border-border/60 bg-secondary/20 p-4">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
            <div>
              <div className="text-[10px] font-medium uppercase tracking-widest text-muted-foreground mb-1">
                Document Type
              </div>
              <div className="text-sm font-medium text-foreground">
                {details.documentType || "—"}
              </div>
            </div>
            <div>
              <div className="text-[10px] font-medium uppercase tracking-widest text-muted-foreground mb-1">
                Retention Category
              </div>
              <div className="text-sm font-medium text-foreground">
                {details.retentionCategory || "—"}
              </div>
            </div>
            <div>
              <div className="text-[10px] font-medium uppercase tracking-widest text-muted-foreground mb-1">
                Originating Department
              </div>
              <div className="text-sm font-medium text-foreground">
                {details.originatingDepartment || "—"}
              </div>
            </div>
            <div>
              <div className="text-[10px] font-medium uppercase tracking-widest text-muted-foreground mb-1">
                Record Series
              </div>
              <div className="text-sm font-medium text-foreground">
                {details.recordSeries || "—"}
              </div>
            </div>
          </div>
        </div>
      </div>

      <div>
        <h3 className="mb-4 flex items-center gap-2 text-xs font-medium text-foreground">
          <Clock className="h-4 w-4 text-cyan-500" />
          Retention Schedule
        </h3>

        <div className="rounded-lg border border-border/60 bg-secondary/20 p-4">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
            <div>
              <div className="text-[10px] font-medium uppercase tracking-widest text-muted-foreground mb-1">
                Retention Period
              </div>
              <div className="text-sm font-medium text-foreground">
                {details.retentionYears
                  ? `${details.retentionYears} years`
                  : "—"}
              </div>
            </div>
            <div>
              <div className="text-[10px] font-medium uppercase tracking-widest text-muted-foreground mb-1">
                Retention Start Date
              </div>
              <div className="text-sm font-medium text-foreground">
                {details.retentionStartDate
                  ? format(new Date(details.retentionStartDate), "MMM d, yyyy")
                  : "—"}
              </div>
            </div>
            <div>
              <div className="text-[10px] font-medium uppercase tracking-widest text-muted-foreground mb-1">
                Retention Expires
              </div>
              <div className="text-sm font-medium text-foreground">
                {details.retentionExpiresAt
                  ? format(new Date(details.retentionExpiresAt), "MMM d, yyyy")
                  : "—"}
              </div>
            </div>
            <div>
              <div className="text-[10px] font-medium uppercase tracking-widest text-muted-foreground mb-1">
                Days Until Expiry
              </div>
              <div className="text-sm font-medium text-foreground">
                {details.retentionExpiresAt
                  ? Math.ceil(
                      (details.retentionExpiresAt - Date.now()) /
                        (1000 * 60 * 60 * 24),
                    )
                  : "—"}
              </div>
            </div>
          </div>
        </div>
      </div>

      <div>
        <h3 className="mb-4 flex items-center gap-2 text-xs font-medium text-foreground">
          <Shield className="h-4 w-4 text-purple-500" />
          Security & Access
        </h3>

        <div className="rounded-lg border border-border/60 bg-secondary/20 p-4">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div>
              <div className="text-[10px] font-medium uppercase tracking-widest text-muted-foreground mb-1">
                Confidentiality Level
              </div>
              <div className="text-sm font-medium text-foreground">
                {details.confidentialityLevel || "—"}
              </div>
            </div>
            <div>
              <div className="text-[10px] font-medium uppercase tracking-widest text-muted-foreground mb-1">
                Legal Hold
              </div>
              <div className="text-sm font-medium text-foreground">
                {details.legalHold ? "Yes" : "No"}
              </div>
            </div>
          </div>
          {details.legalHoldReason && (
            <div className="mt-4 pt-4 border-t border-border/40">
              <div className="text-[10px] font-medium uppercase tracking-widest text-muted-foreground mb-2">
                Legal Hold Reason
              </div>
              <p className="text-sm text-muted-foreground">
                {details.legalHoldReason}
              </p>
            </div>
          )}
          {details.accessRestrictions &&
            details.accessRestrictions.length > 0 && (
              <div className="mt-4 pt-4 border-t border-border/40">
                <div className="text-[10px] font-medium uppercase tracking-widest text-muted-foreground mb-2">
                  Access Restrictions
                </div>
                <div className="flex flex-wrap gap-2">
                  {details.accessRestrictions.map((restriction) => (
                    <span
                      key={restriction}
                      className="inline-flex rounded px-2 py-0.5 text-xs font-medium bg-amber-500/10 text-amber-500"
                    >
                      {restriction}
                    </span>
                  ))}
                </div>
              </div>
            )}
        </div>
      </div>

      <div>
        <h3 className="mb-4 flex items-center gap-2 text-xs font-medium text-foreground">
          <FileText className="h-4 w-4 text-green-500" />
          Physical & Digital Location
        </h3>

        <div className="rounded-lg border border-border/60 bg-secondary/20 p-4">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
            <div>
              <div className="text-[10px] font-medium uppercase tracking-widest text-muted-foreground mb-1">
                Box Number
              </div>
              <div className="text-sm font-medium text-foreground">
                {details.boxNumber || "—"}
              </div>
            </div>
            <div>
              <div className="text-[10px] font-medium uppercase tracking-widest text-muted-foreground mb-1">
                Folder Number
              </div>
              <div className="text-sm font-medium text-foreground">
                {details.folderNumber || "—"}
              </div>
            </div>
            <div>
              <div className="text-[10px] font-medium uppercase tracking-widest text-muted-foreground mb-1">
                File Format
              </div>
              <div className="text-sm font-medium text-foreground">
                {details.fileFormat || "—"}
              </div>
            </div>
            <div>
              <div className="text-[10px] font-medium uppercase tracking-widest text-muted-foreground mb-1">
                File Size
              </div>
              <div className="text-sm font-medium text-foreground">
                {details.fileSize
                  ? `${(details.fileSize / 1024 / 1024).toFixed(2)} MB`
                  : "—"}
              </div>
            </div>
          </div>
          {details.pageCount && (
            <div className="mt-4 pt-4 border-t border-border/40">
              <div className="text-[10px] font-medium uppercase tracking-widest text-muted-foreground mb-2">
                Document Details
              </div>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div>
                  <div className="text-[10px] font-medium uppercase tracking-widest text-muted-foreground mb-1">
                    Page Count
                  </div>
                  <div className="text-sm font-medium text-foreground">
                    {details.pageCount}
                  </div>
                </div>
                <div>
                  <div className="text-[10px] font-medium uppercase tracking-widest text-muted-foreground mb-1">
                    OCR Processed
                  </div>
                  <div className="text-sm font-medium text-foreground">
                    {details.ocrProcessed ? "Yes" : "No"}
                  </div>
                </div>
              </div>
            </div>
          )}
          {details.keywords && details.keywords.length > 0 && (
            <div className="mt-4 pt-4 border-t border-border/40">
              <div className="text-[10px] font-medium uppercase tracking-widest text-muted-foreground mb-2">
                Keywords
              </div>
              <div className="flex flex-wrap gap-2">
                {details.keywords.map((keyword) => (
                  <span
                    key={keyword}
                    className="inline-flex rounded px-2 py-0.5 text-xs font-medium bg-blue-500/10 text-blue-500"
                  >
                    {keyword}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {details.flaggedForDestruction && (
        <div>
          <h3 className="mb-4 flex items-center gap-2 text-xs font-medium text-foreground">
            <Trash2 className="h-4 w-4 text-red-500" />
            Destruction Information
          </h3>

          <div className="rounded-lg border border-red-500/30 bg-red-500/5 p-4">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
              <div>
                <div className="text-[10px] font-medium uppercase tracking-widest text-muted-foreground mb-1">
                  Destruction Date
                </div>
                <div className="text-sm font-medium text-foreground">
                  {details.destructionDate
                    ? format(new Date(details.destructionDate), "MMM d, yyyy")
                    : "—"}
                </div>
              </div>
              <div>
                <div className="text-[10px] font-medium uppercase tracking-widest text-muted-foreground mb-1">
                  Destruction Method
                </div>
                <div className="text-sm font-medium text-foreground">
                  {details.destructionMethod || "—"}
                </div>
              </div>
              <div>
                <div className="text-[10px] font-medium uppercase tracking-widest text-muted-foreground mb-1">
                  Witnessed By
                </div>
                <div className="text-sm font-medium text-foreground">
                  {details.destructionWitnessedBy || "—"}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
