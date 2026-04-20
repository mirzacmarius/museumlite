"use client";

import { useOrganization } from "@/components/organization-provider";
import { useFeatureAccess } from "@/hooks/use-feature-access";
import { formatDistanceLocale } from "@/lib/format-date";
import { useCurrentLocale, useScopedI18n } from "@/locales/client";
import { api } from "@v1/backend/convex/_generated/api";
import type { Id } from "@v1/backend/convex/_generated/dataModel";
import { Avatar, AvatarFallback, AvatarImage } from "@v1/ui/avatar";
import { Button } from "@v1/ui/button";
import { FeatureGuard } from "@v1/ui/feature-guard";
import { Input } from "@v1/ui/input";
import { Label } from "@v1/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@v1/ui/select";
import { useQuery } from "convex/react";
import { Calendar, Filter, RotateCcw, X } from "lucide-react";
import { useState } from "react";

export default function ActivityPage() {
  const { currentOrganizationId, isLoading } = useOrganization();
  const { hasFeature } = useFeatureAccess();
  const locale = useCurrentLocale();
  const t = useScopedI18n("activityLog");

  const [selectedUserId, setSelectedUserId] = useState<string>("");
  const [selectedEntityType, setSelectedEntityType] = useState<string>("");
  const [actionFilter, setActionFilter] = useState<string>("");
  const [fromDate, setFromDate] = useState<string>("");
  const [toDate, setToDate] = useState<string>("");
  const [cursor, setCursor] = useState<string | undefined>(undefined);

  const entityTypes = useQuery(api.auditLog.getEntityTypes, {});

  const availableActions = useQuery(
    api.auditLog.getAvailableActions,
    currentOrganizationId
      ? { organizationId: currentOrganizationId as Id<"organizations"> }
      : "skip",
  );

  const activeUsers = useQuery(
    api.auditLog.getActiveUsers,
    currentOrganizationId
      ? { organizationId: currentOrganizationId as Id<"organizations"> }
      : "skip",
  );

  const queryArgs = currentOrganizationId
    ? {
        organizationId: currentOrganizationId as Id<"organizations">,
        userId: selectedUserId ? (selectedUserId as Id<"users">) : undefined,
        entityType: selectedEntityType || undefined,
        action: actionFilter || undefined,
        fromDate: fromDate ? new Date(fromDate).getTime() : undefined,
        toDate: toDate ? new Date(toDate).setHours(23, 59, 59, 999) : undefined,
        limit: 50,
        cursor,
      }
    : "skip";

  const auditLogData = useQuery(api.auditLog.list, queryArgs);

  const hasFilters =
    selectedUserId || selectedEntityType || actionFilter || fromDate || toDate;

  const clearFilters = () => {
    setSelectedUserId("");
    setSelectedEntityType("");
    setActionFilter("");
    setFromDate("");
    setToDate("");
    setCursor(undefined);
  };

  const loadMore = () => {
    if (auditLogData?.nextCursor) {
      setCursor(auditLogData.nextCursor);
    }
  };

  const handleFilterChange = <T,>(setter: (value: T) => void, value: T) => {
    setCursor(undefined);
    setter(value);
  };

  if (isLoading) {
    return (
      <div className="flex h-full w-full items-center justify-center">
        <p className="text-muted-foreground">{t("loading")}</p>
      </div>
    );
  }

  if (!currentOrganizationId) {
    return (
      <div className="flex h-full w-full items-center justify-center">
        <div className="flex flex-col items-center gap-4 rounded-lg border p-8">
          <div className="text-center">
            <h3 className="text-lg font-semibold">{t("selectOrganization")}</h3>
            <p className="mt-2 text-sm text-muted-foreground">
              {t("selectOrgDescription")}
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <FeatureGuard
      featureName={t("featureName")}
      isLocked={!hasFeature("compliance")}
      tierNeeded="enterprise"
    >
      <div className="flex h-full min-h-0 w-full flex-col gap-6">
        <div className="flex w-full flex-col gap-2">
          <h2 className="text-xl font-medium text-foreground">{t("title")}</h2>
          <p className="text-sm text-muted-foreground">{t("description")}</p>
        </div>

        <div className="rounded-lg border border-border bg-card p-4">
          <div className="flex items-center gap-2 mb-4">
            <Filter className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm font-medium">{t("filters")}</span>
            {hasFilters && (
              <Button
                variant="ghost"
                size="sm"
                onClick={clearFilters}
                className="ml-auto text-muted-foreground"
              >
                <RotateCcw className="mr-2 h-3 w-3" />
                {t("clearFilters")}
              </Button>
            )}
          </div>

          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
            <div className="space-y-2">
              <Label
                htmlFor="user-filter"
                className="text-xs text-muted-foreground"
              >
                {t("user")}
              </Label>
              <Select
                value={selectedUserId || "all"}
                onValueChange={(value) =>
                  handleFilterChange(
                    setSelectedUserId,
                    value === "all" ? "" : value,
                  )
                }
              >
                <SelectTrigger id="user-filter">
                  <SelectValue placeholder={t("user")} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t("user")}</SelectItem>
                  {activeUsers?.map((user) => (
                    <SelectItem key={user._id} value={user._id}>
                      {user.name || user.email || t("unknownUser")}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label
                htmlFor="entity-filter"
                className="text-xs text-muted-foreground"
              >
                {t("entityType")}
              </Label>
              <Select
                value={selectedEntityType || "all"}
                onValueChange={(value) =>
                  handleFilterChange(
                    setSelectedEntityType,
                    value === "all" ? "" : value,
                  )
                }
              >
                <SelectTrigger id="entity-filter">
                  <SelectValue placeholder={t("entityType")} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t("entityType")}</SelectItem>
                  {entityTypes?.map((type) => (
                    <SelectItem key={type} value={type}>
                      {type.charAt(0).toUpperCase() + type.slice(1)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label
                htmlFor="action-filter"
                className="text-xs text-muted-foreground"
              >
                {t("action")}
              </Label>
              <Select
                value={actionFilter || "all"}
                onValueChange={(value) =>
                  handleFilterChange(
                    setActionFilter,
                    value === "all" ? "" : value,
                  )
                }
              >
                <SelectTrigger id="action-filter">
                  <SelectValue placeholder={t("action")} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t("action")}</SelectItem>
                  {availableActions?.map((action) => (
                    <SelectItem key={action} value={action}>
                      {action}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label
                htmlFor="from-date"
                className="text-xs text-muted-foreground"
              >
                {t("fromDate")}
              </Label>
              <Input
                id="from-date"
                type="date"
                value={fromDate}
                onChange={(e) =>
                  handleFilterChange(setFromDate, e.target.value)
                }
                className="h-9"
              />
            </div>

            <div className="space-y-2">
              <Label
                htmlFor="to-date"
                className="text-xs text-muted-foreground"
              >
                {t("toDate")}
              </Label>
              <Input
                id="to-date"
                type="date"
                value={toDate}
                onChange={(e) => handleFilterChange(setToDate, e.target.value)}
                className="h-9"
              />
            </div>
          </div>
        </div>

        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            {auditLogData === undefined ? (
              t("loading")
            ) : (
              <>
                <span className="font-medium text-primary">
                  {auditLogData.totalCount}
                </span>{" "}
                {t("entriesFound", {
                  count: auditLogData.totalCount,
                  plural: auditLogData.totalCount === 1 ? "" : "s",
                })}
              </>
            )}
          </p>
        </div>

        <div className="flex-1 space-y-2">
          {auditLogData === undefined ? (
            <div className="flex h-64 items-center justify-center">
              <p className="text-muted-foreground">{t("loadingActivity")}</p>
            </div>
          ) : auditLogData.entries.length === 0 ? (
            <div className="flex h-64 flex-col items-center justify-center gap-4 rounded-lg border border-dashed">
              <div className="rounded-full bg-muted p-3">
                <Calendar className="h-6 w-6 text-muted-foreground" />
              </div>
              <div className="text-center">
                <h3 className="font-medium">{t("noActivity")}</h3>
                <p className="mt-1 text-sm text-muted-foreground">
                  {hasFilters ? t("tryAdjustFilters") : t("activityAppears")}
                </p>
              </div>
              {hasFilters && (
                <Button variant="outline" size="sm" onClick={clearFilters}>
                  <X className="mr-2 h-3 w-3" />
                  {t("clearFilters")}
                </Button>
              )}
            </div>
          ) : (
            <>
              <div className="space-y-2">
                {auditLogData.entries.map((entry) => (
                  <div
                    key={entry._id}
                    className="flex items-start gap-4 rounded-lg border border-border bg-card p-4"
                  >
                    <Avatar className="h-9 w-9">
                      {entry.userImage && (
                        <AvatarImage
                          src={entry.userImage}
                          alt={entry.userName}
                        />
                      )}
                      <AvatarFallback>
                        {entry.userName
                          ? entry.userName
                              .split(" ")
                              .map((n) => n[0])
                              .join("")
                              .toUpperCase()
                              .slice(0, 2)
                          : "?"}
                      </AvatarFallback>
                    </Avatar>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-sm">
                          {entry.userName ||
                            entry.userEmail ||
                            t("unknownUser")}
                        </span>
                        <span className="text-muted-foreground text-sm">
                          {entry.action}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="rounded bg-secondary px-2 py-0.5 text-xs capitalize">
                          {entry.entityType}
                        </span>
                        <span className="text-xs text-muted-foreground font-mono truncate">
                          {entry.entityId}
                        </span>
                      </div>
                    </div>

                    <span className="text-xs text-muted-foreground whitespace-nowrap">
                      {formatDistanceLocale(new Date(entry.timestamp), locale, {
                        addSuffix: true,
                      })}
                    </span>
                  </div>
                ))}
              </div>

              {auditLogData.nextCursor && (
                <div className="flex justify-center pt-4">
                  <Button variant="outline" onClick={loadMore}>
                    {t("loadMore")}
                  </Button>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </FeatureGuard>
  );
}
