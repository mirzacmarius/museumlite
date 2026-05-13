"use client";

import { api } from "@v1/backend/convex/_generated/api";
import type { Id } from "@v1/backend/convex/_generated/dataModel";
import { Button } from "@v1/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@v1/ui/popover";
import { cn } from "@v1/ui/utils";
import { useMutation, useQuery } from "convex/react";
import { ArrowRightLeft, Bell, Check, CheckCheck } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
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
  const [isOpen, setIsOpen] = useState(false);

  const unreadCount = useQuery(
    api.notifications.getUnreadCount,
    currentOrganizationId
      ? {
          organizationId: currentOrganizationId as Id<"organizations">,
        }
      : "skip",
  );
  const notificationCenter = useQuery(
    api.notifications.getNotificationCenter,
    currentOrganizationId && isOpen
      ? {
          organizationId: currentOrganizationId as Id<"organizations">,
          limit: 20,
        }
      : "skip",
  );

  const markRead = useMutation(api.notifications.markRead);
  const markAllRead = useMutation(api.notifications.markAllRead);

  if (!currentOrganizationId) {
    return null;
  }

  const notifications = notificationCenter?.notifications ?? [];
  const unreadCountValue = unreadCount ?? notificationCenter?.unreadCount ?? 0;

  const handleMarkRead = async (notificationId: string) => {
    await markRead({ notificationId: notificationId as Id<"notifications"> });
  };

  const handleMarkAllRead = async () => {
    if (!currentOrganizationId) return;
    await markAllRead({
      organizationId: currentOrganizationId as Id<"organizations">,
    });
  };

  const getNotificationLink = (
    entityType?: string,
    entityId?: string,
  ): string | null => {
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
  };

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" className="relative size-8 rounded-full p-0">
          <Bell className="h-4 w-4" />
          {unreadCountValue > 0 && (
            <span className="absolute right-0 top-0 flex size-4 items-center justify-center rounded-full bg-primary text-[10px] font-bold text-primary-foreground">
              {unreadCountValue > 9 ? "9+" : unreadCountValue}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-0" align="end">
        <div className="flex flex-col">
          {/* Header */}
          <div className="flex items-center justify-between border-b px-4 py-3">
            <h3 className="text-sm font-semibold">Notifications</h3>
            {unreadCountValue > 0 && (
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

          <div className="border-b px-4 py-2">
            <Link
              href="/notifications"
              className="text-xs text-primary hover:underline"
            >
              View all notifications
            </Link>
          </div>

          {/* Notifications List */}
          <div className="max-h-96 overflow-y-auto">
            {isOpen && notificationCenter === undefined ? (
              <div className="flex flex-col items-center justify-center px-4 py-8 text-center">
                <p className="text-sm text-muted-foreground">Loading...</p>
              </div>
            ) : notifications.length === 0 ? (
              <div className="flex flex-col items-center justify-center px-4 py-8 text-center">
                <Bell className="mb-2 size-8 text-muted-foreground" />
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
                        {notification.relatedEntityType === "move_request" ? (
                          <ArrowRightLeft className="h-4 w-4 text-primary" />
                        ) : !notification.read ? (
                          <div className="h-2 w-2 rounded-full bg-primary" />
                        ) : null}
                      </div>
                      <div className="flex flex-1 flex-col gap-1">
                        <p className="text-sm font-medium">
                          {notification.title}
                        </p>
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
