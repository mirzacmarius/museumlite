"use client";

import { useOrganization } from "@/components/organization-provider";
import { PermissionGate } from "@/components/permission-gate";
import { useFeatureAccess } from "@/hooks/use-feature-access";
import { useScopedI18n } from "@/locales/client";
import { api } from "@v1/backend/convex/_generated/api";
import type { Id } from "@v1/backend/convex/_generated/dataModel";
import { Button } from "@v1/ui/button";
import { FeatureGuard } from "@v1/ui/feature-guard";
import { Input } from "@v1/ui/input";
import { useQuery } from "convex/react";
import {
  Box,
  Calendar,
  GalleryVerticalEnd,
  Plus,
  Search,
  User,
  Wrench,
} from "lucide-react";
import Link from "next/link";
import { useState } from "react";

export default function ConservationPage() {
  const t = useScopedI18n("conservation");
  const { currentOrganizationId, isLoading } = useOrganization();
  const { hasFeature } = useFeatureAccess();
  const [searchQuery, setSearchQuery] = useState("");

  if (isLoading) {
    return (
      <div className="flex h-full w-full items-center justify-center bg-background">
        <p className="text-muted-foreground">{t("loading")}</p>
      </div>
    );
  }

  if (!currentOrganizationId) {
    return (
      <div className="flex h-full w-full items-center justify-center bg-background px-6 py-8">
        <div className="flex flex-col items-center gap-4 rounded-lg border border-border bg-muted/50 p-8">
          <GalleryVerticalEnd className="h-12 w-12 text-muted-foreground" />
          <div className="text-center">
            <h3 className="text-lg font-semibold text-foreground">
              {t("noOrganizationTitle")}
            </h3>
            <p className="mt-2 text-sm text-muted-foreground">
              {t("noOrganizationDescription")}
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <FeatureGuard
      featureName={t("title")}
      isLocked={!hasFeature("conservation")}
      tierNeeded="pro"
    >
      <div className="flex h-full w-full bg-background px-6">
        <div className="z-10 mx-auto flex h-full w-full max-w-screen-xl gap-12">
          <div className="flex w-full flex-col rounded-lg border border-border bg-muted/20">
            <div className="flex w-full items-center justify-between rounded-lg p-6">
              <div className="flex flex-col gap-2">
                <h2 className="text-xl font-medium text-foreground">
                  {t("title")}
                </h2>
                <p className="text-sm font-normal text-muted-foreground">
                  {t("description")}
                </p>
              </div>
              <PermissionGate permission="collections.update">
                <Button
                  asChild
                  className="bg-zinc-100 text-zinc-900 hover:bg-zinc-200 dark:bg-zinc-100 dark:text-zinc-900"
                >
                  <Link href="/conservation/new">
                    <Plus className="mr-2 h-4 w-4" />
                    {t("newTreatment")}
                  </Link>
                </Button>
              </PermissionGate>
            </div>
            <div className="flex w-full px-6">
              <div className="w-full border-b border-border" />
            </div>

            <div className="border-b border-border px-6 py-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder={t("searchPlaceholder")}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9 bg-muted/50 border-border text-foreground/80 placeholder:text-muted-foreground focus-visible:ring-ring"
                />
              </div>
            </div>

            <TreatmentList
              organizationId={currentOrganizationId}
              searchQuery={searchQuery}
            />
          </div>
        </div>
      </div>
    </FeatureGuard>
  );
}

function TreatmentList({
  organizationId,
  searchQuery,
}: {
  organizationId: string;
  searchQuery: string;
}) {
  const t = useScopedI18n("conservation");
  const treatments = useQuery(api.conservationTreatments.listByOrganization, {
    organizationId: organizationId as Id<"organizations">,
  });

  if (treatments === undefined) {
    return (
      <div className="flex h-64 items-center justify-center">
        <p className="text-muted-foreground">{t("loadingTreatments")}</p>
      </div>
    );
  }

  const filteredTreatments = treatments.filter((treatment) => {
    const query = searchQuery.toLowerCase();
    return (
      treatment.title.toLowerCase().includes(query) ||
      treatment.description?.toLowerCase().includes(query) ||
      treatment.notes?.toLowerCase().includes(query) ||
      treatment.collectionTitle?.toLowerCase().includes(query) ||
      treatment.performedByName?.toLowerCase().includes(query)
    );
  });

  if (filteredTreatments.length === 0) {
    return (
      <div className="flex h-64 flex-col items-center justify-center gap-4">
        <Wrench className="h-12 w-12 text-muted-foreground" />
        <div className="text-center">
          <p className="text-muted-foreground">{t("noTreatmentsFound")}</p>
          <p className="mt-2 text-sm text-muted-foreground">
            {searchQuery ? t("tryAdjustingSearch") : t("createFirstRecord")}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-4 p-6 md:grid-cols-2 lg:grid-cols-3">
      {filteredTreatments.map((treatment) => (
        <TreatmentCard key={treatment._id} treatment={treatment} />
      ))}
    </div>
  );
}

const TREATMENT_TYPE_STYLES: Record<string, string> = {
  routine: "bg-muted text-muted-foreground border-border",
  stabilization: "bg-amber-500/10 text-amber-400 border-amber-500/20",
  restoration: "bg-purple-500/10 text-purple-400 border-purple-500/20",
  cleaning: "bg-cyan-500/10 text-cyan-400 border-cyan-500/20",
  repair: "bg-rose-500/10 text-rose-400 border-rose-500/20",
  assessment: "bg-blue-500/10 text-blue-400 border-blue-500/20",
  other: "bg-muted text-muted-foreground border-border",
};

interface Treatment {
  _id: string;
  treatmentType: string;
  title: string;
  description: string;
  performedAt: number;
  performedByName?: string;
  collectionTitle?: string;
}

function TreatmentCard({ treatment }: { treatment: Treatment }) {
  const typeStyle =
    TREATMENT_TYPE_STYLES[treatment.treatmentType] ||
    TREATMENT_TYPE_STYLES.other;

  return (
    <Link
      href={`/conservation/${treatment._id}`}
      className="group flex flex-col justify-between rounded-xl border border-border bg-card p-5 transition-all hover:bg-muted/80 hover:border-border hover:shadow-lg hover:shadow-black/30"
    >
      <div className="space-y-4">
        <div className="flex items-start justify-between">
          <span
            className={`rounded-full border px-2.5 py-0.5 text-[10px] font-medium uppercase tracking-wider ${typeStyle}`}
          >
            {treatment.treatmentType}
          </span>
        </div>

        <div>
          <h3 className="font-semibold text-foreground group-hover:text-white line-clamp-2">
            {treatment.title}
          </h3>
          <p className="mt-2 text-xs text-muted-foreground line-clamp-2">
            {treatment.description}
          </p>
        </div>

        <div className="flex flex-col gap-2 border-t border-border/50 pt-4 text-xs text-muted-foreground">
          <div className="flex items-center gap-1.5">
            <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
            <span>{new Date(treatment.performedAt).toLocaleDateString()}</span>
          </div>
          {treatment.performedByName && (
            <div className="flex items-center gap-1.5">
              <User className="h-3.5 w-3.5 text-muted-foreground" />
              <span>{treatment.performedByName}</span>
            </div>
          )}
        </div>
      </div>

      {treatment.collectionTitle && (
        <div className="mt-4 flex items-center gap-2 rounded-lg bg-background/50 px-3 py-2 text-xs text-muted-foreground group-hover:text-muted-foreground transition-colors">
          <Box className="h-3.5 w-3.5" />
          <span className="truncate">{treatment.collectionTitle}</span>
        </div>
      )}
    </Link>
  );
}
