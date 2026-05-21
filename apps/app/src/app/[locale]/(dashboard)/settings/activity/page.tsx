"use client";

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
import { useReducer } from "react";
import { useOrganization } from "@/components/organization-provider";
import { useClientRelativeTime } from "@/hooks/use-client-date-format";
import { useFeatureAccess } from "@/hooks/use-feature-access";
import { useCurrentLocale, useScopedI18n } from "@/locales/client";

interface ActivityPageState {
  selectedUserId: string;
  selectedEntityType: string;
  actionFilter: string;
  fromDate: string;
  toDate: string;
  cursor: string | undefined;
}

type ActivityPageAction =
  | { type: "setSelectedUserId"; value: string }
  | { type: "setSelectedEntityType"; value: string }
  | { type: "setActionFilter"; value: string }
  | { type: "setFromDate"; value: string }
  | { type: "setToDate"; value: string }
  | { type: "setCursor"; value: string | undefined }
  | { type: "clearFilters" };

const initialActivityPageState: ActivityPageState = {
  selectedUserId: "",
  selectedEntityType: "",
  actionFilter: "",
  fromDate: "",
  toDate: "",
  cursor: undefined,
};

function activityPageReducer(
  state: ActivityPageState,
  action: ActivityPageAction,
): ActivityPageState {
  switch (action.type) {
    case "setSelectedUserId":
      return { ...state, selectedUserId: action.value, cursor: undefined };
    case "setSelectedEntityType":
      return { ...state, selectedEntityType: action.value, cursor: undefined };
    case "setActionFilter":
      return { ...state, actionFilter: action.value, cursor: undefined };
    case "setFromDate":
      return { ...state, fromDate: action.value, cursor: undefined };
    case "setToDate":
      return { ...state, toDate: action.value, cursor: undefined };
    case "setCursor":
      return { ...state, cursor: action.value };
    case "clearFilters":
      return initialActivityPageState;
  }
}

function ActivityTimestamp({ timestamp }: { timestamp: number }) {
  const locale = useCurrentLocale();
  return useClientRelativeTime(timestamp, locale, { addSuffix: true });
}

interface ActivityUser {
  _id: string;
  name?: string | null;
  email?: string | null;
}

interface ActivityEntry {
  _id: string;
  action: string;
  entityId: string;
  entityType: string;
  timestamp: number;
  userEmail?: string | null;
  userImage?: string | null;
  userName?: string | null;
}

function ActivityPageHeader({
  description,
  title,
}: {
  description: string;
  title: string;
}) {
  return (
    <div className="flex w-full flex-col gap-2">
      <h2 className="text-xl font-medium text-foreground">{title}</h2>
      <p className="text-sm text-muted-foreground">{description}</p>
    </div>
  );
}

function ActivityFilters({
  actionFilter,
  activeUsers,
  availableActions,
  clearFilters,
  entityTypes,
  fromDate,
  hasFilters,
  labels,
  onActionChange,
  onEntityTypeChange,
  onFromDateChange,
  onToDateChange,
  onUserChange,
  selectedEntityType,
  selectedUserId,
  toDate,
}: {
  actionFilter: string;
  activeUsers: ActivityUser[] | undefined;
  availableActions: string[] | undefined;
  clearFilters: () => void;
  entityTypes: string[] | undefined;
  fromDate: string;
  hasFilters: boolean;
  labels: {
    action: string;
    clearFilters: string;
    entityType: string;
    filters: string;
    fromDate: string;
    toDate: string;
    unknownUser: string;
    user: string;
  };
  onActionChange: (value: string) => void;
  onEntityTypeChange: (value: string) => void;
  onFromDateChange: (value: string) => void;
  onToDateChange: (value: string) => void;
  onUserChange: (value: string) => void;
  selectedEntityType: string;
  selectedUserId: string;
  toDate: string;
}) {
  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <div className="mb-4 flex items-center gap-2">
        <Filter className="size-4 text-muted-foreground" />
        <span className="text-sm font-medium">{labels.filters}</span>
        {hasFilters ? (
          <Button
            variant="ghost"
            size="sm"
            onClick={clearFilters}
            className="ml-auto text-muted-foreground"
          >
            <RotateCcw className="mr-2 size-3" />
            {labels.clearFilters}
          </Button>
        ) : null}
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
        <div className="space-y-2">
          <Label
            htmlFor="user-filter"
            className="text-xs text-muted-foreground"
          >
            {labels.user}
          </Label>
          <Select
            value={selectedUserId || "all"}
            onValueChange={(value) =>
              onUserChange(value === "all" ? "" : value)
            }
          >
            <SelectTrigger id="user-filter">
              <SelectValue placeholder={labels.user} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{labels.user}</SelectItem>
              {activeUsers?.map((user) => (
                <SelectItem key={user._id} value={user._id}>
                  {user.name || user.email || labels.unknownUser}
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
            {labels.entityType}
          </Label>
          <Select
            value={selectedEntityType || "all"}
            onValueChange={(value) =>
              onEntityTypeChange(value === "all" ? "" : value)
            }
          >
            <SelectTrigger id="entity-filter">
              <SelectValue placeholder={labels.entityType} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{labels.entityType}</SelectItem>
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
            {labels.action}
          </Label>
          <Select
            value={actionFilter || "all"}
            onValueChange={(value) =>
              onActionChange(value === "all" ? "" : value)
            }
          >
            <SelectTrigger id="action-filter">
              <SelectValue placeholder={labels.action} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{labels.action}</SelectItem>
              {availableActions?.map((action) => (
                <SelectItem key={action} value={action}>
                  {action}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="from-date" className="text-xs text-muted-foreground">
            {labels.fromDate}
          </Label>
          <Input
            id="from-date"
            type="date"
            value={fromDate}
            onChange={(event) => onFromDateChange(event.target.value)}
            className="h-9"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="to-date" className="text-xs text-muted-foreground">
            {labels.toDate}
          </Label>
          <Input
            id="to-date"
            type="date"
            value={toDate}
            onChange={(event) => onToDateChange(event.target.value)}
            className="h-9"
          />
        </div>
      </div>
    </div>
  );
}

function ActivityResultCount({
  isLoading,
  labels,
  totalCount,
}: {
  isLoading: boolean;
  labels: {
    entriesFound: string;
    loading: string;
  };
  totalCount: number | undefined;
}) {
  return (
    <div className="flex items-center justify-between">
      <p className="text-sm text-muted-foreground">
        {isLoading ? (
          labels.loading
        ) : (
          <>
            <span className="font-medium text-primary">{totalCount}</span>{" "}
            {labels.entriesFound}
          </>
        )}
      </p>
    </div>
  );
}

function ActivityEntryRow({
  entry,
  unknownUserLabel,
}: {
  entry: ActivityEntry;
  unknownUserLabel: string;
}) {
  const initials = entry.userName
    ? entry.userName
        .split(" ")
        .map((namePart) => namePart[0])
        .join("")
        .toUpperCase()
        .slice(0, 2)
    : "?";

  return (
    <div className="flex items-start gap-4 rounded-lg border border-border bg-card p-4">
      <Avatar className="size-9">
        {entry.userImage ? (
          <AvatarImage src={entry.userImage} alt={entry.userName ?? ""} />
        ) : null}
        <AvatarFallback>{initials}</AvatarFallback>
      </Avatar>

      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="font-medium text-sm">
            {entry.userName || entry.userEmail || unknownUserLabel}
          </span>
          <span className="text-muted-foreground text-sm">{entry.action}</span>
        </div>
        <div className="mt-1 flex items-center gap-2">
          <span className="rounded bg-secondary px-2 py-0.5 text-xs capitalize">
            {entry.entityType}
          </span>
          <span className="truncate font-mono text-xs text-muted-foreground">
            {entry.entityId}
          </span>
        </div>
      </div>

      <span className="whitespace-nowrap text-xs text-muted-foreground">
        <ActivityTimestamp timestamp={entry.timestamp} />
      </span>
    </div>
  );
}

function ActivityList({
  entries,
  hasFilters,
  isLoading,
  labels,
  nextCursor,
  onClearFilters,
  onLoadMore,
}: {
  entries: ActivityEntry[] | undefined;
  hasFilters: boolean;
  isLoading: boolean;
  labels: {
    activityAppears: string;
    clearFilters: string;
    loadMore: string;
    loadingActivity: string;
    noActivity: string;
    tryAdjustFilters: string;
    unknownUser: string;
  };
  nextCursor: string | undefined;
  onClearFilters: () => void;
  onLoadMore: () => void;
}) {
  if (isLoading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <p className="text-muted-foreground">{labels.loadingActivity}</p>
      </div>
    );
  }

  if (!entries || entries.length === 0) {
    return (
      <div className="flex h-64 flex-col items-center justify-center gap-4 rounded-lg border border-dashed">
        <div className="rounded-full bg-muted p-3">
          <Calendar className="size-6 text-muted-foreground" />
        </div>
        <div className="text-center">
          <h3 className="font-medium">{labels.noActivity}</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            {hasFilters ? labels.tryAdjustFilters : labels.activityAppears}
          </p>
        </div>
        {hasFilters ? (
          <Button variant="outline" size="sm" onClick={onClearFilters}>
            <X className="mr-2 size-3" />
            {labels.clearFilters}
          </Button>
        ) : null}
      </div>
    );
  }

  return (
    <>
      <div className="space-y-2">
        {entries.map((entry) => (
          <ActivityEntryRow
            key={entry._id}
            entry={entry}
            unknownUserLabel={labels.unknownUser}
          />
        ))}
      </div>

      {nextCursor ? (
        <div className="flex justify-center pt-4">
          <Button variant="outline" onClick={onLoadMore}>
            {labels.loadMore}
          </Button>
        </div>
      ) : null}
    </>
  );
}

export default function ActivityPage() {
  const { currentOrganizationId, isLoading } = useOrganization();
  const { hasFeature } = useFeatureAccess();
  const t = useScopedI18n("activityLog");

  const [state, dispatch] = useReducer(
    activityPageReducer,
    initialActivityPageState,
  );

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
        userId: state.selectedUserId
          ? (state.selectedUserId as Id<"users">)
          : undefined,
        entityType: state.selectedEntityType || undefined,
        action: state.actionFilter || undefined,
        fromDate: state.fromDate
          ? new Date(state.fromDate).getTime()
          : undefined,
        toDate: state.toDate
          ? new Date(state.toDate).setHours(23, 59, 59, 999)
          : undefined,
        limit: 50,
        cursor: state.cursor,
      }
    : "skip";

  const auditLogData = useQuery(api.auditLog.list, queryArgs);

  const hasFilters =
    state.selectedUserId ||
    state.selectedEntityType ||
    state.actionFilter ||
    state.fromDate ||
    state.toDate;

  const clearFilters = () => {
    dispatch({ type: "clearFilters" });
  };

  const loadMore = () => {
    if (auditLogData?.nextCursor) {
      dispatch({ type: "setCursor", value: auditLogData.nextCursor });
    }
  };

  if (isLoading) {
    return (
      <div className="flex size-full items-center justify-center">
        <p className="text-muted-foreground">{t("loading")}</p>
      </div>
    );
  }

  if (!currentOrganizationId) {
    return (
      <div className="flex size-full items-center justify-center">
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
        <ActivityPageHeader title={t("title")} description={t("description")} />

        <ActivityFilters
          actionFilter={state.actionFilter}
          activeUsers={activeUsers}
          availableActions={availableActions}
          clearFilters={clearFilters}
          entityTypes={entityTypes}
          fromDate={state.fromDate}
          hasFilters={Boolean(hasFilters)}
          labels={{
            action: t("action"),
            clearFilters: t("clearFilters"),
            entityType: t("entityType"),
            filters: t("filters"),
            fromDate: t("fromDate"),
            toDate: t("toDate"),
            unknownUser: t("unknownUser"),
            user: t("user"),
          }}
          onActionChange={(value) =>
            dispatch({ type: "setActionFilter", value })
          }
          onEntityTypeChange={(value) =>
            dispatch({ type: "setSelectedEntityType", value })
          }
          onFromDateChange={(value) => dispatch({ type: "setFromDate", value })}
          onToDateChange={(value) => dispatch({ type: "setToDate", value })}
          onUserChange={(value) =>
            dispatch({ type: "setSelectedUserId", value })
          }
          selectedEntityType={state.selectedEntityType}
          selectedUserId={state.selectedUserId}
          toDate={state.toDate}
        />

        <ActivityResultCount
          isLoading={auditLogData === undefined}
          labels={{
            entriesFound: t("entriesFound", {
              count: auditLogData?.totalCount ?? 0,
              plural: auditLogData?.totalCount === 1 ? "" : "s",
            }),
            loading: t("loading"),
          }}
          totalCount={auditLogData?.totalCount}
        />

        <div className="flex-1 space-y-2">
          <ActivityList
            entries={auditLogData?.entries}
            hasFilters={Boolean(hasFilters)}
            isLoading={auditLogData === undefined}
            labels={{
              activityAppears: t("activityAppears"),
              clearFilters: t("clearFilters"),
              loadMore: t("loadMore"),
              loadingActivity: t("loadingActivity"),
              noActivity: t("noActivity"),
              tryAdjustFilters: t("tryAdjustFilters"),
              unknownUser: t("unknownUser"),
            }}
            nextCursor={auditLogData?.nextCursor ?? undefined}
            onClearFilters={clearFilters}
            onLoadMore={loadMore}
          />
        </div>
      </div>
    </FeatureGuard>
  );
}
