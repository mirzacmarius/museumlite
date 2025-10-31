"use client";

import { api } from "@v1/backend/convex/_generated/api";
import type { Id } from "@v1/backend/convex/_generated/dataModel";
import { Button } from "@v1/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@v1/ui/popover";
import { cn } from "@v1/ui/utils";
import { useQuery, useMutation } from "convex/react";
import { Bell, Check, CheckCheck } from "lucide-react";
import Link from "next/link";
import { useOrganization } from "./organization-provider";

function formatRelativeTime(timestamp: number): string {
  const now = Date.now();
  const diff = now - timestamp;
  const seconds = Math.floor(diff / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);
  const weeks = Math.floor(days / 7);
  const months = Math.floor(days / 30);
  const years = Math.floor(days / 365);

  if (seconds < 60) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days < 7) return `${days}d ago`;
  if (weeks < 4) return `${weeks}w ago`;
  if (months < 12) return `${months}mo ago`;
  return `${years}y ago`;
}

export function NotificationBell() {
  const { currentOrganizationId } = useOrganization();

  const notificationsData = useQuery(
    api.audit.listNotifications,
    currentOrganizationId
      ? { organizationId: currentOrganizationId as Id<"organizations">, limit: 20 }
      : "skip",
  );

  const markRead = useMutation(api.audit.markRead);
  const markAllRead = useMutation(api.audit.markAllRead);

  if (!currentOrganizationId) {
    return null;
  }

  const notifications = notificationsData?.notifications ?? [];
  const unreadCount = notificationsData?.unreadCount ?? 0;

  const handleMarkRead = async (notificationId: string) => {
    await markRead({ notificationId: notificationId as Id<"notifications"> });
  };

  const handleMarkAllRead = async () => {
    if (!currentOrganizationId) return;
    await markAllRead({ organizationId: currentOrganizationId as Id<"organizations"> });
  };

  const getNotificationLink = (
    entityType?: string,
    entityId?: string,
  ): string | null => {
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
  };

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="ghost" className="relative h-8 w-8 rounded-full p-0">
          <Bell className="h-4 w-4" />
          {unreadCount > 0 && (
            <span className="absolute right-0 top-0 flex h-4 w-4 items-center justify-center rounded-full bg-primary text-[10px] font-bold text-primary-foreground">
              {unreadCount > 9 ? "9+" : unreadCount}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-0" align="end">
        <div className="flex flex-col">
          {/* Header */}
          <div className="flex items-center justify-between border-b px-4 py-3">
            <h3 className="text-sm font-semibold">Notifications</h3>
            {unreadCount > 0 && (
              <Button
                variant="ghost"
                size="sm"
                className="h-7 text-xs"
                onClick={handleMarkAllRead}
              >
                <CheckCheck className="mr-1 h-3 w-3" />
                Mark all read
              </Button>
            )}
          </div>

          {/* Notifications List */}
          <div className="max-h-96 overflow-y-auto">
            {notifications.length === 0 ? (
              <div className="flex flex-col items-center justify-center px-4 py-8 text-center">
                <Bell className="mb-2 h-8 w-8 text-muted-foreground" />
                <p className="text-sm text-muted-foreground">
                  No notifications
                </p>
              </div>
            ) : (
              <div className="divide-y">
                {notifications.map((notification) => {
                  const link = getNotificationLink(
                    notification.relatedEntityType,
                    notification.relatedEntityId,
                  );
                  const NotificationContent = (
                    <div
                      className={cn(
                        "flex items-start gap-3 px-4 py-3 transition-colors hover:bg-muted/50",
                        !notification.read && "bg-muted/30",
                      )}
                    >
                      <div className="mt-0.5 flex-shrink-0">
                        {!notification.read && (
                          <div className="h-2 w-2 rounded-full bg-primary" />
                        )}
                      </div>
                      <div className="flex flex-1 flex-col gap-1">
                        <p className="text-sm font-medium">{notification.title}</p>
                        <p className="text-xs text-muted-foreground">
                          {notification.message}
                        </p>
                        <div className="flex items-center justify-between">
                          <span className="text-xs text-muted-foreground">
                            {formatRelativeTime(notification.createdAt)}
                          </span>
                          {!notification.read && (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-6 px-2 text-xs"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleMarkRead(notification._id);
                              }}
                            >
                              <Check className="h-3 w-3" />
                            </Button>
                          )}
                        </div>
                      </div>
                    </div>
                  );

                  if (link) {
                    return (
                      <Link key={notification._id} href={link}>
                        {NotificationContent}
                      </Link>
                    );
                  }

                  return (
                    <div key={notification._id}>{NotificationContent}</div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}

