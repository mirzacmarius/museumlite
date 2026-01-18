"use client";

import { useOrganization } from "@/components/organization-provider";
import { useFeatureAccess } from "@/hooks/use-feature-access";
import { useScopedI18n } from "@/locales/client";
import { api } from "@v1/backend/convex/_generated/api";
import type { Id } from "@v1/backend/convex/_generated/dataModel";
import { Button } from "@v1/ui/button";
import { useQuery } from "convex/react";
import {
  BookCopy,
  BookOpen,
  BookUser,
  Building2,
  DollarSign,
  Library,
  Loader2,
  RefreshCw,
  ShoppingCart,
  TrendingUp,
} from "lucide-react";
import Link from "next/link";

export default function LibraryDashboardPage() {
  const { currentOrganizationId, organizations, isLoading } = useOrganization();
  const { hasModule } = useFeatureAccess();
  const t = useScopedI18n("library");

  const isLibraryEnabled = hasModule("library");

  const librarySettings = useQuery(
    api.library.settings.get,
    currentOrganizationId && isLibraryEnabled
      ? { organizationId: currentOrganizationId as Id<"organizations"> }
      : "skip",
  );

  const libraryStats = useQuery(
    api.library.settings.getLibraryStats,
    currentOrganizationId && isLibraryEnabled
      ? { organizationId: currentOrganizationId as Id<"organizations"> }
      : "skip",
  );

  if (isLoading) {
    return (
      <div className="flex h-full w-full items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!organizations || organizations.length === 0) {
    return (
      <div className="flex h-full w-full items-center justify-center bg-background px-6 py-8">
        <div className="flex flex-col items-center gap-4 rounded-lg border border-border bg-card p-8">
          <Building2 className="h-12 w-12 text-muted-foreground" />
          <div className="text-center">
            <h3 className="text-lg font-semibold">
              {t("noOrganizationTitle")}
            </h3>
            <p className="mt-2 text-sm text-muted-foreground">
              {t("noOrganizationDescription")}
            </p>
          </div>
          <Button asChild>
            <Link href="/organizations/new">{t("createOrganization")}</Link>
          </Button>
        </div>
      </div>
    );
  }

  if (!currentOrganizationId) {
    return (
      <div className="flex h-full w-full items-center justify-center bg-background px-6 py-8">
        <div className="flex flex-col items-center gap-4 rounded-lg border border-border bg-card p-8">
          <Library className="h-12 w-12 text-muted-foreground" />
          <div className="text-center">
            <h3 className="text-lg font-semibold">{t("selectOrganization")}</h3>
            <p className="mt-2 text-sm text-muted-foreground">
              {t("selectOrganizationDescription")}
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (isLibraryEnabled === false) {
    return (
      <div className="flex h-full w-full items-center justify-center bg-background px-6 py-8">
        <div className="flex flex-col items-center gap-4 rounded-lg border border-border bg-card p-8">
          <Library className="h-12 w-12 text-muted-foreground" />
          <div className="text-center">
            <h3 className="text-lg font-semibold">{t("notEnabled")}</h3>
            <p className="mt-2 text-sm text-muted-foreground">
              {t("notEnabledDescription")}
            </p>
          </div>
          <Button asChild>
            <Link href="/settings/integrations">{t("enableIntegration")}</Link>
          </Button>
        </div>
      </div>
    );
  }

  const quickActions = [
    {
      title: t("actions.catalog"),
      description: t("actions.catalogDescription"),
      icon: BookCopy,
      href: "/library/catalog",
      color: "text-blue-500",
    },
    {
      title: t("actions.patrons"),
      description: t("actions.patronsDescription"),
      icon: BookUser,
      href: "/library/patrons",
      color: "text-green-500",
    },
    {
      title: t("actions.circulation"),
      description: t("actions.circulationDescription"),
      icon: RefreshCw,
      href: "/library/circulation",
      color: "text-purple-500",
    },
    {
      title: t("actions.fines"),
      description: t("actions.finesDescription"),
      icon: DollarSign,
      href: "/library/fines",
      color: "text-orange-500",
    },
    {
      title: t("actions.acquisitions"),
      description: t("actions.acquisitionsDescription"),
      icon: ShoppingCart,
      href: "/library/acquisitions",
      color: "text-pink-500",
    },
  ];

  return (
    <div className="flex h-full w-full bg-background px-6">
      <div className="z-10 mx-auto flex h-full w-full max-w-screen-xl gap-6 flex-col py-6">
        {/* Header */}
        <div className="flex w-full flex-col rounded-lg border border-border bg-card p-6">
          <div className="flex items-center gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10">
              <Library className="h-6 w-6 text-primary" />
            </div>
            <div>
              <h1 className="text-2xl font-semibold">{t("title")}</h1>
              <p className="text-sm text-muted-foreground">
                {t("description")}
              </p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="flex flex-col rounded-lg border border-border bg-card p-4">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">
                {t("stats.totalItems")}
              </span>
              <BookOpen className="h-4 w-4 text-muted-foreground" />
            </div>
            <span className="mt-2 text-2xl font-semibold">
              {libraryStats?.totalItems ?? 0}
            </span>
            <span className="text-xs text-muted-foreground">
              {t("stats.inCatalog")}
            </span>
          </div>
          <div className="flex flex-col rounded-lg border border-border bg-card p-4">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">
                {t("stats.activePatrons")}
              </span>
              <BookUser className="h-4 w-4 text-muted-foreground" />
            </div>
            <span className="mt-2 text-2xl font-semibold">
              {libraryStats?.activePatrons ?? 0}
            </span>
            <span className="text-xs text-muted-foreground">
              {t("stats.registeredMembers")}
            </span>
          </div>
          <div className="flex flex-col rounded-lg border border-border bg-card p-4">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">
                {t("stats.checkedOut")}
              </span>
              <RefreshCw className="h-4 w-4 text-muted-foreground" />
            </div>
            <span className="mt-2 text-2xl font-semibold">
              {libraryStats?.checkedOutItems ?? 0}
            </span>
            <span className="text-xs text-muted-foreground">
              {t("stats.inCirculation")}
            </span>
          </div>
          <div className="flex flex-col rounded-lg border border-border bg-card p-4">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">
                {t("stats.outstandingFines")}
              </span>
              <DollarSign className="h-4 w-4 text-muted-foreground" />
            </div>
            <span className="mt-2 text-2xl font-semibold">
              ${(libraryStats?.outstandingFines ?? 0).toFixed(2)}
            </span>
            <span className="text-xs text-muted-foreground">
              {t("stats.unpaidFines")}
            </span>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="flex w-full flex-col rounded-lg border border-border bg-card">
          <div className="border-b border-border p-6">
            <h2 className="text-lg font-medium">{t("quickActions")}</h2>
            <p className="text-sm text-muted-foreground">
              {t("quickActionsDescription")}
            </p>
          </div>
          <div className="grid grid-cols-1 gap-4 p-6 sm:grid-cols-2 lg:grid-cols-3">
            {quickActions.map((action) => (
              <Link
                key={action.title}
                href={action.href}
                className="flex items-start gap-4 rounded-lg border border-border p-4 transition-colors hover:bg-accent"
              >
                <div
                  className={`flex h-10 w-10 items-center justify-center rounded-lg bg-muted ${action.color}`}
                >
                  <action.icon className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="font-medium">{action.title}</h3>
                  <p className="text-sm text-muted-foreground">
                    {action.description}
                  </p>
                </div>
              </Link>
            ))}
          </div>
        </div>

        {/* Library Settings Info */}
        {librarySettings && (
          <div className="flex w-full flex-col rounded-lg border border-border bg-card">
            <div className="border-b border-border p-6">
              <h2 className="text-lg font-medium">{t("configuration")}</h2>
              <p className="text-sm text-muted-foreground">
                {t("configurationDescription")}
              </p>
            </div>
            <div className="grid grid-cols-1 gap-4 p-6 sm:grid-cols-2 lg:grid-cols-4">
              <div>
                <p className="text-sm text-muted-foreground">
                  {t("settings.defaultLoanPeriod")}
                </p>
                <p className="font-medium">
                  {librarySettings.defaultLoanPeriodDays} {t("periods.days")}
                </p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">
                  {t("settings.finePerDay")}
                </p>
                <p className="font-medium">
                  ${librarySettings.finePerDayDefault.toFixed(2)}
                </p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">
                  {t("settings.maxRenewals")}
                </p>
                <p className="font-medium">
                  {librarySettings.maxRenewalsAllowed}
                </p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">
                  {t("settings.classificationSystem")}
                </p>
                <p className="font-medium capitalize">
                  {librarySettings.classificationSystem === "lc"
                    ? t("settings.libraryOfCongress")
                    : librarySettings.classificationSystem}
                </p>
              </div>
            </div>
            <div className="border-t border-border bg-secondary/50 px-6 py-3 dark:bg-card">
              <Button variant="ghost" size="sm" asChild>
                <Link href="/settings/integrations/library">
                  {t("manageSettings")}
                </Link>
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
