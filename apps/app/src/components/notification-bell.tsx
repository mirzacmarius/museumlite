"use client";

import { api } from "@v1/backend/convex/_generated/api";
import type { Id } from "@v1/backend/convex/_generated/dataModel";
import { notificationEntityHref } from "@v1/backend/convex/utils/notificationLinks";
import { Button } from "@v1/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@v1/ui/popover";
import { cn } from "@v1/ui/utils";
import { useMutation, useQuery } from "convex/react";
import { ArrowRightLeft, Bell, Check, CheckCheck } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { useClientRelativeTime } from "@/hooks/use-client-date-format";
import { getNotificationCopy } from "@/lib/notification-copy";
import { useCurrentLocale, useI18n } from "@/locales/client";
import { useOrganization } from "./organization-provider";

function NotificationTimestamp({ timestamp }: { timestamp: number }) {
  const locale = useCurrentLocale();
  return useClientRelativeTime(timestamp, locale, { addSuffix: true });
}

export function NotificationBell() {
  const translate = useI18n();
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
  // The unread count stops at 10, so anything above nine reads as 9+.
  const unreadLabel = unreadCountValue > 9 ? "9+" : unreadCountValue;

  const handleMarkRead = async (notificationId: string) => {
    await markRead({ notificationId: notificationId as Id<"notifications"> });
  };

  const handleMarkAllRead = async () => {
    if (!currentOrganizationId) return;
    await markAllRead({
      organizationId: currentOrganizationId as Id<"organizations">,
    });
  };

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          className="relative size-8 rounded-full p-0"
          aria-label={
            unreadCountValue > 0
              ? translate("untranslatedComponents.labels.notificationsUnread", {
                  count: unreadLabel,
                })
              : translate("untranslatedComponents.labels.notifications")
          }
        >
          <Bell className="size-4" aria-hidden="true" />
          {unreadCountValue > 0 && (
            <span
              aria-hidden="true"
              className="absolute right-0 top-0 flex size-4 items-center justify-center rounded-full bg-primary text-[10px] font-bold text-primary-foreground"
            >
              {unreadLabel}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-0" align="end">
        <div className="flex flex-col">
          {/* Header */}
          <div className="flex items-center justify-between border-b px-4 py-3">
            <h3 className="text-sm font-semibold">
              {translate("untranslatedComponents.labels.notifications")}
            </h3>
            {unreadCountValue > 0 && (
              <Button
                variant="ghost"
                size="sm"
                className="h-7 text-xs"
                onClick={handleMarkAllRead}
              >
                <CheckCheck className="mr-1 size-3" />
                {translate("untranslatedComponents.labels.markAllRead")}
              </Button>
            )}
          </div>

          <div className="border-b px-4 py-2">
            <Link
              href="/notifications"
              className="text-xs text-primary hover:underline"
            >
              {translate("untranslatedComponents.labels.viewAllNotifications")}
            </Link>
          </div>

          {/* Notifications List */}
          <div className="max-h-96 overflow-y-auto">
            {isOpen && notificationCenter === undefined ? (
              <div className="flex flex-col items-center justify-center px-4 py-8 text-center">
                <p className="text-sm text-muted-foreground">
                  {translate("untranslatedComponents.labels.loading")}
                </p>
              </div>
            ) : notifications.length === 0 ? (
              <div className="flex flex-col items-center justify-center px-4 py-8 text-center">
                <Bell className="mb-2 size-8 text-muted-foreground" />
                <p className="text-sm text-muted-foreground">
                  {translate("untranslatedComponents.labels.noNotifications")}
                </p>
              </div>
            ) : (
              <div className="divide-y">
                {notifications.map((notification) => {
                  const notificationCopy = getNotificationCopy(
                    {
                      type: notification.type,
                      title: notification.title,
                      message: notification.message,
                    },
                    translate,
                  );
                  const link = notificationEntityHref(
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
                          <ArrowRightLeft className="size-4 text-primary" />
                        ) : !notification.read ? (
                          <div className="size-2 rounded-full bg-primary" />
                        ) : null}
                      </div>
                      <div className="flex flex-1 flex-col gap-1">
                        <p className="text-sm font-medium">
                          {notificationCopy.title}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {notificationCopy.message}
                        </p>
                        <div className="flex items-center justify-between">
                          <span className="text-xs text-muted-foreground">
                            <NotificationTimestamp
                              timestamp={notification.createdAt}
                            />
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
                              <Check className="size-3" />
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
