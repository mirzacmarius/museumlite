"use client";

import { ClientDateFns } from "@/components/client-date";
import { useFeatureAccess } from "@/hooks/use-feature-access";
import { useCurrentLocale, useScopedI18n } from "@/locales/client";
import { api } from "@v1/backend/convex/_generated/api";
import type { Id } from "@v1/backend/convex/_generated/dataModel";
import { Button } from "@v1/ui/button";
import { FeatureGuard } from "@v1/ui/feature-guard";
import { cn } from "@v1/ui/utils";
import { useQuery } from "convex/react";
import {
  AlertTriangle,
  Calendar,
  Clock,
  FileText,
  Lock,
  Plus,
  Shield,
  Trash2,
} from "lucide-react";
import { ArchiveDetailsContent } from "./archive-details-content";
interface ArchiveDetailsTabProps {
  collectionId: string;
  organizationId: Id<"organizations">;
}

export function ArchiveDetailsTab({
  collectionId,
  organizationId,
}: ArchiveDetailsTabProps) {
  const locale = useCurrentLocale();
  const t = useScopedI18n("modules.archive");
  const common = useScopedI18n("modules.common");
  const { hasModule } = useFeatureAccess();
  const hasModuleAccess = hasModule("archive");
  const details = useQuery(
    api.archiveDetails.get,
    hasModuleAccess
      ? { collectionId: collectionId as Id<"collections"> }
      : "skip",
  );

  if (!hasModuleAccess) {
    return (
      <FeatureGuard
        featureName={t("moduleName")}
        isLocked={true}
        description={t("moduleDescription")}
        showUpgrade={false}
      >
        <div />
      </FeatureGuard>
    );
  }

  if (details === undefined) {
    return (
      <div className="flex h-32 items-center justify-center">
        <p className="text-sm text-muted-foreground">
          {common("loading", { module: "archive" })}
        </p>
      </div>
    );
  }

  if (details === null) {
    return (
      <div className="space-y-6">
        <div className="flex h-32 flex-col items-center justify-center gap-4 rounded-xl border border-dashed border-border">
          <p className="text-sm text-muted-foreground">
            {common("noDetailsYet", { module: "archive" })}
          </p>
          <Button variant="outline" size="sm">
            <Plus className="mr-2 size-4" />
            {common("addDetails", { module: "Archive" })}
          </Button>
        </div>
      </div>
    );
  }

  return <ArchiveDetailsContent details={details} />;
}
