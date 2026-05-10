"use client";

import { useOrganization } from "@/components/organization-provider";
import { formatDistanceLocale } from "@/lib/format-date";
import { useCurrentLocale, useI18n } from "@/locales/client";
import { api } from "@v1/backend/convex/_generated/api";
import type { Id } from "@v1/backend/convex/_generated/dataModel";
import { Badge } from "@v1/ui/badge";
import { Button } from "@v1/ui/button";
import { EmptyState } from "@v1/ui/empty-state";
import { Tabs, TabsList, TabsTrigger } from "@v1/ui/tabs";
import { cn } from "@v1/ui/utils";
import { useMutation, useQuery } from "convex/react";
import {
  AlertTriangle,
  ArrowRight,
  ArrowRightLeft,
  Bell,
  CalendarClock,
  Check,
  CheckCheck,
  ClipboardCheck,
  FileText,
  Inbox,
  MapPin,
  Package,
  Settings,
  Truck,
  UserCheck,
} from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { NotificationsPageSkeleton } from "./notifications-page-skeleton";

type FilterType = "all" | "unread";
type CategoryType =
  | "all"
  | "approvals"
  | "reminders"
  | "alerts"
  | "assignments"
  | "system";

interface NotificationItem {
  _id: Id<"notifications">;
  type: string;
  title: string;
  message: string;
  read: boolean;
  relatedEntityType?: string;
  relatedEntityId?: string;
  createdAt: number;
  category?: string;
}

function getNotificationIcon(type: string) {
  switch (type) {
    case "loan":
    case "loan_pending":
    case "loan_approved":
      return Truck;
    case "accession":
    case "accession_pending":
    case "accession_approved":
      return FileText;
    case "deaccession":
    case "deaccession_pending":
    case "deaccession_approved":
      return Package;
    case "move_request_created":
    case "move_request_approved":
    case "workflow_rejected":
      return ArrowRightLeft;
    case "location":
      return MapPin;
    default:
      return Bell;
  }
}

function getNotificationLink(
  entityType?: string,
  entityId?: string,
): string | null {
  if (!entityType || !entityId) return null;

  switch (entityType) {
    case "collection":
      return `/collections/${entityId}`;
    case "object":
      return `/objects/${entityId}`;
    case "accession":
      return `/accessions/${entityId}`;
    case "deaccession":
      return `/deaccessions/${entityId}`;
    case "loan":
      return `/loans/${entityId}`;
    case "location":
      return `/locations/${entityId}`;
    case "move_request":
      return `/objects/move-requests/${entityId}`;
    default:
      return null;
  }
}

export default function NotificationsPage() {
  const t = useI18n();
  const locale = useCurrentLocale();
  const { currentOrganizationId, isLoading } = useOrganization();
  const [filter, setFilter] = useState<FilterType>("all");
  const [category, setCategory] = useState<CategoryType>("all");

  const notificationCenter = useQuery(
    api.notifications.getNotificationCenter,
    currentOrganizationId
      ? { organizationId: currentOrganizationId as Id<"organizations"> }
      : "skip",
  );

  const markRead = useMutation(api.notifications.markRead);
  const markAllRead = useMutation(api.notifications.markAllRead);

  const handleMarkRead = async (notificationId: string) => {
    await markRead({ notificationId: notificationId as Id<"notifications"> });
  };

  const handleMarkAllRead = async () => {
    if (!currentOrganizationId) return;
    await markAllRead({
      organizationId: currentOrganizationId as Id<"organizations">,
    });
  };

  if (isLoading) {
    return <NotificationsPageSkeleton />;
  }

  if (!currentOrganizationId) {
    return (
      <div className="flex h-full w-full items-center justify-center">
        <div className="flex flex-col items-center gap-4 rounded-lg border p-8">
          <div className="text-center">
            <h3 className="text-lg font-semibold">
              {t("notificationsPage.selectOrg.title")}
            </h3>
            <p className="mt-2 text-sm text-muted-foreground">
              {t("notificationsPage.selectOrg.description")}
            </p>
          </div>
        </div>
      </div>
    );
  }

  const allNotifications = notificationCenter?.notifications ?? [];
  const unreadCount = notificationCenter?.unreadCount ?? 0;
  const unreadByCategory = notificationCenter?.unreadByCategory ?? {
    approvals: 0,
    reminders: 0,
    alerts: 0,
    assignments: 0,
    system: 0,
  };

  // Filter notifications by category and read status
  const notifications = allNotifications.filter((n: NotificationItem) => {
    const matchesCategory = category === "all" || n.category === category;
    const matchesFilter = filter === "all" || !n.read;
    return matchesCategory && matchesFilter;
  });

  return (
    <div className="flex h-full w-full flex-col gap-6">
      <div className="flex w-full flex-col gap-2">
        <h2 className="text-xl font-medium text-primary">
          {t("notificationsPage.title")}
        </h2>
        <p className="text-sm text-muted-foreground">
          {t("notificationsPage.description")}
        </p>
      </div>

      {/* Category tabs */}
      <Tabs
        value={category}
        onValueChange={(v) => setCategory(v as CategoryType)}
        className="w-full"
      >
        <TabsList className="grid w-full grid-cols-6">
          <TabsTrigger value="all" className="gap-2">
            <Bell className="h-4 w-4" />
            <span className="hidden sm:inline">
              {t("notificationsPage.categories.all")}
            </span>
            {unreadCount > 0 && (
              <Badge variant="secondary" className="ml-1 h-5 px-1.5 text-xs">
                {unreadCount}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="approvals" className="gap-2">
            <ClipboardCheck className="h-4 w-4" />
            <span className="hidden sm:inline">
              {t("notificationsPage.categories.approvals")}
            </span>
            {unreadByCategory.approvals > 0 && (
              <Badge variant="secondary" className="ml-1 h-5 px-1.5 text-xs">
                {unreadByCategory.approvals}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="reminders" className="gap-2">
            <CalendarClock className="h-4 w-4" />
            <span className="hidden sm:inline">
              {t("notificationsPage.categories.reminders")}
            </span>
            {unreadByCategory.reminders > 0 && (
              <Badge variant="secondary" className="ml-1 h-5 px-1.5 text-xs">
                {unreadByCategory.reminders}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="alerts" className="gap-2">
            <AlertTriangle className="h-4 w-4" />
            <span className="hidden sm:inline">
              {t("notificationsPage.categories.alerts")}
            </span>
            {unreadByCategory.alerts > 0 && (
              <Badge variant="destructive" className="ml-1 h-5 px-1.5 text-xs">
                {unreadByCategory.alerts}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="assignments" className="gap-2">
            <UserCheck className="h-4 w-4" />
            <span className="hidden sm:inline">
              {t("notificationsPage.categories.assignments")}
            </span>
            {unreadByCategory.assignments > 0 && (
              <Badge variant="secondary" className="ml-1 h-5 px-1.5 text-xs">
                {unreadByCategory.assignments}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="system" className="gap-2">
            <Settings className="h-4 w-4" />
            <span className="hidden sm:inline">
              {t("notificationsPage.categories.system")}
            </span>
            {unreadByCategory.system > 0 && (
              <Badge variant="secondary" className="ml-1 h-5 px-1.5 text-xs">
                {unreadByCategory.system}
              </Badge>
            )}
          </TabsTrigger>
        </TabsList>
      </Tabs>

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Button
            variant={filter === "all" ? "default" : "outline"}
            size="sm"
            onClick={() => setFilter("all")}
          >
            {t("notificationsPage.filters.all")}
          </Button>
          <Button
            variant={filter === "unread" ? "default" : "outline"}
            size="sm"
            onClick={() => setFilter("unread")}
          >
            {t("notificationsPage.filters.unread")}
            {unreadCount > 0 && (
              <span className="ml-2 rounded-full bg-primary-foreground px-2 py-0.5 text-xs text-primary">
                {unreadCount}
              </span>
            )}
          </Button>
        </div>

        {unreadCount > 0 && (
          <Button variant="ghost" size="sm" onClick={handleMarkAllRead}>
            <CheckCheck className="mr-2 h-4 w-4" />
            {t("notificationsPage.markAllRead")}
          </Button>
        )}
      </div>

      <div className="flex-1">
        {notificationCenter === undefined ? (
          <NotificationsPageSkeleton />
        ) : notifications.length === 0 ? (
          <EmptyState
            icon={Inbox}
            title={
              filter === "unread"
                ? t("notificationsPage.empty.noUnread")
                : t("notificationsPage.empty.noNotifications")
            }
            description={
              filter === "unread"
                ? t("notificationsPage.empty.caughtUp")
                : t("notificationsPage.empty.description")
            }
            action={
              filter === "unread"
                ? {
                    label: t("notificationsPage.viewAll"),
                    onClick: () => setFilter("all"),
                    variant: "outline",
                  }
                : undefined
            }
            variant="card"
            size="md"
          />
        ) : (
          <div className="space-y-2">
            {notifications.map((notification: NotificationItem) => {
              const Icon = getNotificationIcon(notification.type);
              const link = getNotificationLink(
                notification.relatedEntityType,
                notification.relatedEntityId,
              );

              const content = (
                <div
                  className={cn(
                    "flex items-start gap-4 rounded-lg border border-border bg-card p-4 transition-colors",
                    !notification.read &&
                      "border-l-4 border-l-primary bg-primary/5",
                    link && "hover:bg-muted/50 cursor-pointer",
                  )}
                >
                  <div
                    className={cn(
                      "rounded-full p-2",
                      notification.read ? "bg-muted" : "bg-primary/10",
                    )}
                  >
                    <Icon
                      className={cn(
                        "h-4 w-4",
                        notification.read
                          ? "text-muted-foreground"
                          : "text-primary",
                      )}
                    />
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p
                          className={cn(
                            "text-sm",
                            !notification.read && "font-medium",
                          )}
                        >
                          {notification.title}
                        </p>
                        <p className="text-sm text-muted-foreground mt-1">
                          {notification.message}
                        </p>
                      </div>
                      {!notification.read && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-8 w-8 p-0 flex-shrink-0"
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            handleMarkRead(notification._id);
                          }}
                        >
                          <Check className="h-4 w-4" />
                        </Button>
                      )}
                    </div>

                    <div className="flex items-center gap-2 mt-2">
                      <span className="text-xs text-muted-foreground">
                        {formatDistanceLocale(
                          new Date(notification.createdAt),
                          locale,
                          { addSuffix: true },
                        )}
                      </span>
                      {link && (
                        <span className="flex items-center gap-1 text-xs text-primary">
                          {t("notificationsPage.viewDetails")}
                          <ArrowRight className="h-3 w-3" />
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              );

              if (link) {
                return (
                  <Link key={notification._id} href={link}>
                    {content}
                  </Link>
                );
              }

              return <div key={notification._id}>{content}</div>;
            })}
          </div>
        )}
      </div>
    </div>
  );
}
