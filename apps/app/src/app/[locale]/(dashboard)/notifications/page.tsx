"use client";

import { useOrganization } from "@/components/organization-provider";
import { api } from "@v1/backend/convex/_generated/api";
import type { Id } from "@v1/backend/convex/_generated/dataModel";
import { Button } from "@v1/ui/button";
import { cn } from "@v1/ui/utils";
import { useMutation, useQuery } from "convex/react";
import { formatDistanceToNow } from "date-fns";
import {
  ArrowRight,
  Bell,
  Check,
  CheckCheck,
  FileText,
  Inbox,
  MapPin,
  Package,
  Truck,
} from "lucide-react";
import Link from "next/link";
import { useState } from "react";

type FilterType = "all" | "unread";

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
    case "accession":
      return `/accessions/${entityId}`;
    case "deaccession":
      return `/deaccessions/${entityId}`;
    case "loan":
      return `/loans/${entityId}`;
    case "location":
      return `/locations/${entityId}`;
    default:
      return null;
  }
}

export default function NotificationsPage() {
  const { currentOrganizationId, isLoading } = useOrganization();
  const [filter, setFilter] = useState<FilterType>("all");

  const notificationsData = useQuery(
    api.audit.listNotifications,
    currentOrganizationId
      ? {
          organizationId: currentOrganizationId as Id<"organizations">,
          unreadOnly: filter === "unread",
          limit: 100,
        }
      : "skip",
  );

  const markRead = useMutation(api.audit.markRead);
  const markAllRead = useMutation(api.audit.markAllRead);

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
    return (
      <div className="flex h-full w-full items-center justify-center">
        <p className="text-muted-foreground">Loading...</p>
      </div>
    );
  }

  if (!currentOrganizationId) {
    return (
      <div className="flex h-full w-full items-center justify-center">
        <div className="flex flex-col items-center gap-4 rounded-lg border p-8">
          <div className="text-center">
            <h3 className="text-lg font-semibold">Select an Organization</h3>
            <p className="mt-2 text-sm text-muted-foreground">
              Please select an organization from the dropdown above to view
              notifications.
            </p>
          </div>
        </div>
      </div>
    );
  }

  const notifications = notificationsData?.notifications ?? [];
  const unreadCount = notificationsData?.unreadCount ?? 0;

  return (
    <div className="flex h-full w-full flex-col gap-6">
      <div className="flex w-full flex-col gap-2">
        <h2 className="text-xl font-medium text-primary">Notifications</h2>
        <p className="text-sm text-muted-foreground">
          Stay updated on workflow approvals and activity
        </p>
      </div>

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Button
            variant={filter === "all" ? "default" : "outline"}
            size="sm"
            onClick={() => setFilter("all")}
          >
            All
          </Button>
          <Button
            variant={filter === "unread" ? "default" : "outline"}
            size="sm"
            onClick={() => setFilter("unread")}
          >
            Unread
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
            Mark all as read
          </Button>
        )}
      </div>

      <div className="flex-1">
        {notificationsData === undefined ? (
          <div className="flex h-64 items-center justify-center">
            <p className="text-muted-foreground">Loading notifications...</p>
          </div>
        ) : notifications.length === 0 ? (
          <div className="flex h-64 flex-col items-center justify-center gap-4 rounded-lg border border-dashed">
            <div className="rounded-full bg-muted p-3">
              <Inbox className="h-6 w-6 text-muted-foreground" />
            </div>
            <div className="text-center">
              <h3 className="font-medium">
                {filter === "unread"
                  ? "No unread notifications"
                  : "No notifications"}
              </h3>
              <p className="mt-1 text-sm text-muted-foreground">
                {filter === "unread"
                  ? "You're all caught up!"
                  : "Notifications will appear here when there's activity requiring your attention"}
              </p>
            </div>
            {filter === "unread" && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setFilter("all")}
              >
                View all notifications
              </Button>
            )}
          </div>
        ) : (
          <div className="space-y-2">
            {notifications.map((notification) => {
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
                        {formatDistanceToNow(new Date(notification.createdAt), {
                          addSuffix: true,
                        })}
                      </span>
                      {link && (
                        <span className="flex items-center gap-1 text-xs text-primary">
                          View details
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
