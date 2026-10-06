"use client";

import { api } from "@v1/backend/convex/_generated/api";
import type { Id } from "@v1/backend/convex/_generated/dataModel";
import { Button } from "@v1/ui/button";
import { EmptyState } from "@v1/ui/empty-state";
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
  type LucideIcon,
  MapPin,
  Package,
  Settings,
  Truck,
  UserCheck,
} from "lucide-react";
import Link from "next/link";
import { type ReactNode, useState } from "react";
import { useOrganization } from "@/components/organization-provider";
import { useClientRelativeTime } from "@/hooks/use-client-date-format";
import { useCurrentLocale, useI18n } from "@/locales/client";
import { getNotificationCopy } from "@/lib/notification-copy";
import { NotificationsPageSkeleton } from "./notifications-page-skeleton";

type FilterType = "all" | "unread";

const NOTIFICATION_CATEGORIES = [
  "approvals",
  "reminders",
  "alerts",
  "assignments",
  "system",
] as const;

type NotificationCategory = (typeof NOTIFICATION_CATEGORIES)[number];
type CategoryType = "all" | NotificationCategory;

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

interface CategoryTone {
  rail: string;
  iconWrap: string;
  icon: string;
  chip: string;
  dot: string;
}

interface DayGroup {
  label: string;
  items: NotificationItem[];
}

const EMPTY_UNREAD_BY_CATEGORY: Record<NotificationCategory, number> = {
  approvals: 0,
  reminders: 0,
  alerts: 0,
  assignments: 0,
  system: 0,
};

const CATEGORY_ICONS: Record<CategoryType, LucideIcon> = {
  all: Bell,
  approvals: ClipboardCheck,
  reminders: CalendarClock,
  alerts: AlertTriangle,
  assignments: UserCheck,
  system: Settings,
};

const CATEGORY_TABS = (["all", ...NOTIFICATION_CATEGORIES] as const).map(
  (value) => ({
    value,
    icon: CATEGORY_ICONS[value],
  }),
);

const CATEGORY_TONES: Record<CategoryType, CategoryTone> = {
  all: {
    rail: "bg-primary",
    iconWrap: "border-primary/20 bg-primary/10",
    icon: "text-primary",
    chip: "border-primary/20 bg-primary/10 text-primary",
    dot: "bg-primary",
  },
  approvals: {
    rail: "bg-blue-400",
    iconWrap: "border-blue-500/20 bg-blue-500/10",
    icon: "text-blue-400",
    chip: "border-blue-500/20 bg-blue-500/10 text-blue-400",
    dot: "bg-blue-400",
  },
  reminders: {
    rail: "bg-indigo-400",
    iconWrap: "border-indigo-500/20 bg-indigo-500/10",
    icon: "text-indigo-400",
    chip: "border-indigo-500/20 bg-indigo-500/10 text-indigo-400",
    dot: "bg-indigo-400",
  },
  alerts: {
    rail: "bg-amber-400",
    iconWrap: "border-amber-500/20 bg-amber-500/10",
    icon: "text-amber-400",
    chip: "border-amber-500/20 bg-amber-500/10 text-amber-400",
    dot: "bg-amber-400",
  },
  assignments: {
    rail: "bg-emerald-400",
    iconWrap: "border-emerald-500/20 bg-emerald-500/10",
    icon: "text-emerald-400",
    chip: "border-emerald-500/20 bg-emerald-500/10 text-emerald-400",
    dot: "bg-emerald-400",
  },
  system: {
    rail: "bg-zinc-400",
    iconWrap: "border-white/10 bg-muted/50",
    icon: "text-muted-foreground",
    chip: "border-border/60 bg-muted/40 text-muted-foreground",
    dot: "bg-zinc-400",
  },
};

const NOTIFICATION_ICONS: Record<string, LucideIcon> = {
  loan: Truck,
  loan_pending: Truck,
  loan_approved: Truck,
  accession: FileText,
  accession_pending: FileText,
  accession_approved: FileText,
  deaccession: Package,
  deaccession_pending: Package,
  deaccession_approved: Package,
  move_request_created: ArrowRightLeft,
  move_request_approved: ArrowRightLeft,
  workflow_rejected: ArrowRightLeft,
  location: MapPin,
};

const ENTITY_PATHS: Record<string, string> = {
  collection: "/collections",
  object: "/objects",
  accession: "/accessions",
  deaccession: "/deaccessions",
  loan: "/loans",
  location: "/locations",
  move_request: "/objects/move-requests",
};

const DAY_MS = 24 * 60 * 60 * 1000;
const DAY_FORMAT_OPTIONS = {
  weekday: "short",
  month: "short",
  day: "numeric",
} satisfies Intl.DateTimeFormatOptions;
const dayFormatters = {
  en: new Intl.DateTimeFormat("en", DAY_FORMAT_OPTIONS),
  fr: new Intl.DateTimeFormat("fr", DAY_FORMAT_OPTIONS),
  es: new Intl.DateTimeFormat("es", DAY_FORMAT_OPTIONS),
  no: new Intl.DateTimeFormat("no", DAY_FORMAT_OPTIONS),
  ro: new Intl.DateTimeFormat("ro", DAY_FORMAT_OPTIONS),
} satisfies Record<ReturnType<typeof useCurrentLocale>, Intl.DateTimeFormat>;
const FEED_LOADING_KEYS = ["a", "b", "c", "d"] as const;

function isNotificationCategory(value: string): value is NotificationCategory {
  return (NOTIFICATION_CATEGORIES as readonly string[]).includes(value);
}

function getCategoryTone(category?: string): CategoryTone {
  if (category && isNotificationCategory(category))
    return CATEGORY_TONES[category];
  return CATEGORY_TONES.all;
}

function getNotificationIcon(type: string): LucideIcon {
  return NOTIFICATION_ICONS[type] ?? Bell;
}

function getNotificationLink(
  entityType?: string,
  entityId?: string,
): string | null {
  if (!entityType || !entityId) return null;
  const basePath = ENTITY_PATHS[entityType];
  return basePath ? `${basePath}/${entityId}` : null;
}

function startOfLocalDay(timestamp: number) {
  const date = new Date(timestamp);
  date.setHours(0, 0, 0, 0);
  return date.getTime();
}

function getDayGroupLabel(timestamp: number, formatter: Intl.DateTimeFormat) {
  const today = startOfLocalDay(Date.now());
  const day = startOfLocalDay(timestamp);

  if (day === today) return "Today";
  if (day === today - DAY_MS) return "Yesterday";

  return formatter.format(new Date(timestamp));
}

function groupNotificationsByDay(
  notifications: NotificationItem[],
  formatter: Intl.DateTimeFormat,
): DayGroup[] {
  const groups: DayGroup[] = [];
  const indexByDay = new Map<number, number>();

  for (const notification of notifications) {
    const day = startOfLocalDay(notification.createdAt);
    const existingIndex = indexByDay.get(day);

    if (existingIndex === undefined) {
      indexByDay.set(day, groups.length);
      groups.push({
        label: getDayGroupLabel(notification.createdAt, formatter),
        items: [notification],
      });
      continue;
    }

    groups[existingIndex]?.items.push(notification);
  }

  return groups;
}

interface SegmentedControlProps {
  ariaLabel: string;
  children: ReactNode;
}

function SegmentedControl({ ariaLabel, children }: SegmentedControlProps) {
  return (
    <fieldset
      aria-label={ariaLabel}
      className="inline-flex flex-wrap rounded-md border border-border/60 p-0.5 dark:border-white/10"
    >
      {children}
    </fieldset>
  );
}

interface SegmentedButtonProps {
  pressed: boolean;
  onClick: () => void;
  children: ReactNode;
  className?: string;
}

function SegmentedButton({
  pressed,
  onClick,
  children,
  className,
}: SegmentedButtonProps) {
  return (
    <button
      type="button"
      aria-pressed={pressed}
      onClick={onClick}
      className={cn(
        "flex h-7 items-center gap-1.5 rounded px-2.5 text-xs transition-[background-color,color,transform] duration-150 ease-[cubic-bezier(0.2,0,0,1)] focus-visible:outline focus-visible:outline-indigo-400 active:scale-[0.96]",
        pressed
          ? "bg-accent text-accent-foreground"
          : "text-muted-foreground hover:text-foreground",
        className,
      )}
    >
      {children}
    </button>
  );
}

interface CategoryTabsProps {
  category: CategoryType;
  unreadCount: number;
  unreadByCategory: Record<NotificationCategory, number>;
  onCategoryChange: (category: CategoryType) => void;
}

function CategoryTabs({
  category,
  unreadCount,
  unreadByCategory,
  onCategoryChange,
}: CategoryTabsProps) {
  const t = useI18n();

  return (
    <SegmentedControl ariaLabel={t("untranslatedDashboard.notifications.categories")}>
      {CATEGORY_TABS.map(({ value, icon: Icon }) => {
        const count = value === "all" ? unreadCount : unreadByCategory[value];
        const tone = CATEGORY_TONES[value];

        return (
          <SegmentedButton
            key={value}
            pressed={category === value}
            onClick={() => onCategoryChange(value)}
          >
            <Icon className="size-3.5" strokeWidth={1.75} />
            <span className="hidden sm:inline">
              {t(`notificationsPage.categories.${value}`)}
            </span>
            {count > 0 ? (
              <span
                className={cn(
                  "inline-flex h-4 min-w-4 items-center justify-center rounded px-1 text-[10px] font-medium tabular-nums",
                  tone.chip,
                )}
              >
                {count}
              </span>
            ) : null}
          </SegmentedButton>
        );
      })}
    </SegmentedControl>
  );
}

interface UnreadPulseChipsProps {
  unreadCount: number;
  unreadByCategory: Record<NotificationCategory, number>;
  onSelect: (category: CategoryType) => void;
}

function UnreadPulseChips({
  unreadCount,
  unreadByCategory,
  onSelect,
}: UnreadPulseChipsProps) {
  const t = useI18n();

  if (unreadCount === 0) return null;

  const chips = NOTIFICATION_CATEGORIES.filter(
    (value) => unreadByCategory[value] > 0,
  );

  return (
    <div className="mt-4 flex flex-wrap items-center gap-1.5">
      <span className="mr-1 text-[10px] font-medium uppercase tracking-widest text-muted-foreground">
        {t("untranslatedDashboard.notifications.needsAttention")}
      </span>
      {chips.map((value) => {
        const Icon = CATEGORY_ICONS[value];
        const tone = CATEGORY_TONES[value];
        const count = unreadByCategory[value];

        return (
          <button
            key={value}
            type="button"
            onClick={() => onSelect(value)}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-xs transition-[border-color,background-color,transform] duration-150 ease-[cubic-bezier(0.2,0,0,1)] hover:border-border active:scale-[0.96] dark:hover:border-white/25",
              tone.chip,
            )}
          >
            <Icon className="size-3.5" strokeWidth={1.75} />
            <span>{t(`notificationsPage.categories.${value}`)}</span>
            <span className="tabular-nums opacity-80">{count}</span>
          </button>
        );
      })}
    </div>
  );
}

interface NotificationRowProps {
  notification: NotificationItem;
  onMarkRead: (notificationId: string) => void;
}

function NotificationRow({ notification, onMarkRead }: NotificationRowProps) {
  const t = useI18n();
  const locale = useCurrentLocale();
  const copy = getNotificationCopy(notification, t);
  const Icon = getNotificationIcon(notification.type);
  const tone = getCategoryTone(notification.category);
  const link = getNotificationLink(
    notification.relatedEntityType,
    notification.relatedEntityId,
  );
  const createdAtLabel = useClientRelativeTime(notification.createdAt, locale, {
    addSuffix: true,
  });
  const categoryLabel =
    notification.category && isNotificationCategory(notification.category)
      ? notification.category
      : null;

  const body = (
    <div
      className={cn(
        "group relative flex items-start gap-3 px-4 py-3.5 transition-[background-color] duration-150 ease-[cubic-bezier(0.2,0,0,1)]",
        !notification.read && "bg-primary/[0.03]",
        link && "cursor-pointer hover:bg-muted/40",
      )}
    >
      {!notification.read ? (
        <span
          aria-hidden
          className={cn(
            "absolute inset-y-3 left-0 w-0.5 rounded-full",
            tone.rail,
          )}
        />
      ) : null}

      <div
        className={cn(
          "mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-md border",
          notification.read
            ? "border-border/60 bg-muted/40 text-muted-foreground dark:border-white/10"
            : tone.iconWrap,
        )}
      >
        <Icon
          className={cn(
            "size-4",
            notification.read ? "text-muted-foreground" : tone.icon,
          )}
          strokeWidth={1.75}
        />
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <p
                className={cn(
                  "truncate text-sm tracking-tight text-foreground",
                  !notification.read && "font-medium",
                )}
              >
                {copy.title}
              </p>
              {!notification.read ? (
                <span className="inline-flex items-center gap-1 rounded border border-primary/20 bg-primary/10 px-1.5 py-0.5 text-[10px] font-medium text-primary">
                  <span className="size-1 rounded-full bg-current" />
                  {t("notificationsPage.filters.unread")}
                </span>
              ) : null}
            </div>
            <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">
              {copy.message}
            </p>
          </div>

          {!notification.read ? (
            <Button
              variant="ghost"
              size="sm"
              className="size-8 shrink-0 p-0 opacity-0 transition-opacity duration-150 group-hover:opacity-100 focus-visible:opacity-100"
              title={t("untranslatedDashboard.notifications.markAsRead")}
              onClick={(event) => {
                event.preventDefault();
                event.stopPropagation();
                onMarkRead(notification._id);
              }}
            >
              <Check className="size-4" />
            </Button>
          ) : null}
        </div>

        <div className="mt-2.5 flex flex-wrap items-center gap-x-3 gap-y-1">
          <span className="font-mono text-[10px] tracking-wide text-muted-foreground">
            {createdAtLabel}
          </span>
          {categoryLabel ? (
            <>
              <span className="text-muted-foreground/40">/</span>
              <span className="inline-flex items-center gap-1.5 text-[10px] uppercase tracking-widest text-muted-foreground">
                <span className={cn("size-1 rounded-full", tone.dot)} />
                {t(`notificationsPage.categories.${categoryLabel}`)}
              </span>
            </>
          ) : null}
          {link ? (
            <span className="ml-auto inline-flex items-center gap-1 text-[11px] text-muted-foreground transition-colors group-hover:text-foreground">
              {t("notificationsPage.viewDetails")}
              <ArrowRight className="size-3 transition-transform duration-150 group-hover:translate-x-0.5" />
            </span>
          ) : null}
        </div>
      </div>
    </div>
  );

  if (link)
    return (
      <Link href={link} className="block">
        {body}
      </Link>
    );

  return body;
}

export default function NotificationsPage() {
  const t = useI18n();
  const locale = useCurrentLocale();
  const dayFormatter = dayFormatters[locale];
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

  async function handleMarkRead(notificationId: string) {
    await markRead({ notificationId: notificationId as Id<"notifications"> });
  }

  async function handleMarkAllRead() {
    if (!currentOrganizationId) return;
    await markAllRead({
      organizationId: currentOrganizationId as Id<"organizations">,
    });
  }

  if (isLoading) return <NotificationsPageSkeleton />;

  if (!currentOrganizationId) {
    return (
      <div className="flex size-full items-center justify-center bg-background px-6 py-8">
        <div className="flex flex-col items-center gap-4 rounded-xl border border-border bg-card p-8">
          <Bell className="size-12 text-muted-foreground" strokeWidth={1.5} />
          <div className="text-center">
            <h3 className="text-lg font-semibold text-foreground">
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
  const unreadByCategory =
    notificationCenter?.unreadByCategory ?? EMPTY_UNREAD_BY_CATEGORY;

  const notifications = allNotifications.filter((n: NotificationItem) => {
    const matchesCategory = category === "all" || n.category === category;
    const matchesFilter = filter === "all" || !n.read;
    return matchesCategory && matchesFilter;
  });

  const dayGroups = groupNotificationsByDay(notifications, dayFormatter);

  return (
    <div className="flex h-full min-h-0 w-full flex-col overflow-y-auto bg-background p-4 sm:p-6 custom-scrollbar">
      <section className="border-b border-border/60 pb-6 dark:border-white/10">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="flex flex-wrap items-center gap-3 text-xl font-medium tracking-tight text-foreground">
              {t("notificationsPage.title")}
              {unreadCount > 0 ? (
                <span className="inline-flex items-center gap-1.5 rounded border border-primary/20 bg-primary/10 px-2 py-1 text-[10px] font-normal tracking-normal text-primary">
                  <span className="size-1.5 animate-pulse rounded-full bg-current" />
                  {unreadCount} {t("untranslatedDashboard.notifications.waiting")}
                </span>
              ) : (
                <span className="inline-flex items-center gap-1.5 rounded border border-emerald-500/20 bg-emerald-500/10 px-2 py-1 text-[10px] font-normal tracking-normal text-emerald-400">
                  <span className="size-1 rounded-full bg-current" />
                  {t("untranslatedDashboard.notifications.clear")}
                </span>
              )}
            </h2>
            <p className="mt-1.5 text-sm text-muted-foreground">
              {t("notificationsPage.description")}
            </p>
          </div>

          {unreadCount > 0 ? (
            <Button
              variant="outline"
              size="sm"
              className="h-8 border-border/60 dark:border-white/10"
              onClick={handleMarkAllRead}
            >
              <CheckCheck className="mr-2 size-3.5" strokeWidth={1.75} />
              {t("notificationsPage.markAllRead")}
            </Button>
          ) : null}
        </div>

        <UnreadPulseChips
          unreadCount={unreadCount}
          unreadByCategory={unreadByCategory}
          onSelect={(nextCategory) => {
            setCategory(nextCategory);
            setFilter("unread");
          }}
        />
      </section>

      <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
        <CategoryTabs
          category={category}
          unreadCount={unreadCount}
          unreadByCategory={unreadByCategory}
          onCategoryChange={setCategory}
        />

        <SegmentedControl ariaLabel={t("untranslatedDashboard.notifications.readStatus")}>
          <SegmentedButton
            pressed={filter === "all"}
            onClick={() => setFilter("all")}
          >
            {t("notificationsPage.filters.all")}
          </SegmentedButton>
          <SegmentedButton
            pressed={filter === "unread"}
            onClick={() => setFilter("unread")}
          >
            {t("notificationsPage.filters.unread")}
            {unreadCount > 0 ? (
              <span className="tabular-nums text-[10px] opacity-70">
                {unreadCount}
              </span>
            ) : null}
          </SegmentedButton>
        </SegmentedControl>
      </div>

      <div className="mt-5 min-h-0 flex-1">
        {notificationCenter === undefined ? (
          <div className="overflow-hidden rounded-xl border border-border/60 dark:border-white/10 dark:bg-zinc-900/40">
            {FEED_LOADING_KEYS.map((key) => (
              <div
                key={key}
                className="flex items-start gap-3 border-b border-border/60 px-4 py-3.5 last:border-b-0 dark:border-white/10"
              >
                <div className="size-9 animate-pulse rounded-md bg-muted/60" />
                <div className="min-w-0 flex-1 space-y-2">
                  <div className="h-4 w-2/5 animate-pulse rounded bg-muted/70" />
                  <div className="h-3 w-3/5 animate-pulse rounded bg-muted/50" />
                  <div className="h-2.5 w-28 animate-pulse rounded bg-muted/40" />
                </div>
              </div>
            ))}
          </div>
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
          <div className="overflow-hidden rounded-xl border border-border/60 dark:border-white/10 dark:bg-zinc-900/40">
            {dayGroups.map((group, groupIndex) => (
              <section key={group.label}>
                <div
                  className={cn(
                    "sticky top-0 z-10 flex items-center justify-between gap-3 border-b border-border/60 bg-background/90 px-4 py-2 backdrop-blur-sm dark:border-white/10 dark:bg-zinc-950/80",
                    groupIndex > 0 && "border-t",
                  )}
                >
                  <h3 className="text-[10px] font-medium uppercase tracking-widest text-muted-foreground">
                    {group.label}
                  </h3>
                  <span className="font-mono text-[10px] tabular-nums text-muted-foreground/70">
                    {group.items.length}
                  </span>
                </div>
                <div className="divide-y divide-border/60 dark:divide-white/10">
                  {group.items.map((notification) => (
                    <NotificationRow
                      key={notification._id}
                      notification={notification}
                      onMarkRead={handleMarkRead}
                    />
                  ))}
                </div>
              </section>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
