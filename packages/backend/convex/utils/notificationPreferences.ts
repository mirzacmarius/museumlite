import { type Infer, v } from "convex/values";
import type { Doc, Id } from "../_generated/dataModel";
import type { QueryCtx } from "../_generated/server";
import {
  NOTIFICATION_CATEGORIES,
  type NotificationCategory,
} from "./notificationTypes";

/** A recipient's choice for one category: notify at all, and also by email. */
export const categoryChannels = v.object({
  enabled: v.boolean(),
  email: v.boolean(),
});
export interface CategoryChannels {
  enabled: boolean;
  email: boolean;
}

export const categoryChannelMatrix = v.object({
  approvals: categoryChannels,
  reminders: categoryChannels,
  alerts: categoryChannels,
  assignments: categoryChannels,
  system: categoryChannels,
});
export type CategoryChannelMatrix = Record<
  NotificationCategory,
  CategoryChannels
>;

export type EmailCadence = "instant" | "daily" | "weekly";

/**
 * When a recipient's chosen categories are emailed: as notifications happen,
 * or grouped into a digest at a local time (`time`, and `day` with 0 for
 * Sunday) in an IANA time zone.
 */
export const emailSchedule = v.union(
  v.object({ cadence: v.literal("instant") }),
  v.object({
    cadence: v.literal("daily"),
    time: v.string(),
    timezone: v.string(),
  }),
  v.object({
    cadence: v.literal("weekly"),
    day: v.number(),
    time: v.string(),
    timezone: v.string(),
  }),
);
export type EmailSchedule = Infer<typeof emailSchedule>;
export type DigestSchedule = Exclude<EmailSchedule, { cadence: "instant" }>;

const DEFAULT_DIGEST_TIME = "08:00";
const DEFAULT_DIGEST_DAY = 1;

const CATEGORY_ENABLED_FIELDS = {
  approvals: "enableApprovals",
  reminders: "enableReminders",
  alerts: "enableAlerts",
  assignments: "enableAssignments",
  system: "enableSystem",
} as const satisfies Record<
  NotificationCategory,
  keyof Doc<"notificationPreferences">
>;

/**
 * The previous settings page had one email switch and described its emails as
 * loan requests and task assignments, so saved choices without per-category
 * email cover those two categories.
 */
const LEGACY_EMAIL_CATEGORIES: readonly NotificationCategory[] = [
  "approvals",
  "assignments",
];

/** A recipient's stored choices, with defaults for anything never saved. */
export interface ChannelPolicy {
  /** Whether each category notifies, and whether it is chosen for email. */
  categories: CategoryChannelMatrix;
  /** Cadence of the chosen email categories; null when email is off. */
  emailCadence: EmailCadence | null;
  /**
   * The saved digest time for a daily or weekly cadence. Null for instant
   * email, and for a digest chosen before digests had a time, which sends
   * nothing until a time is saved.
   */
  digestSchedule: DigestSchedule | null;
  disabledTypes: ReadonlySet<string>;
}

function savedDigestSchedule(
  preferences: Doc<"notificationPreferences"> | null,
): DigestSchedule | null {
  const time = preferences?.emailDigestTime;
  const timezone = preferences?.timezone;
  if (time === undefined || timezone === undefined) return null;
  switch (preferences?.emailDigestFrequency) {
    case "daily":
      return { cadence: "daily", time, timezone };
    case "weekly":
      return preferences.emailDigestDay === undefined
        ? null
        : {
            cadence: "weekly",
            day: preferences.emailDigestDay,
            time,
            timezone,
          };
    default:
      return null;
  }
}

export function channelPolicy(
  preferences: Doc<"notificationPreferences"> | null,
): ChannelPolicy {
  const frequency = preferences?.emailDigestFrequency;
  const emailCadence =
    preferences?.emailEnabled === true &&
    (frequency === "instant" || frequency === "daily" || frequency === "weekly")
      ? frequency
      : null;
  const emailCategories = new Set(
    preferences?.emailCategories ?? LEGACY_EMAIL_CATEGORIES,
  );
  const entries = NOTIFICATION_CATEGORIES.map((category) => {
    const enabled = preferences?.[CATEGORY_ENABLED_FIELDS[category]] !== false;
    return [
      category,
      {
        enabled,
        email:
          enabled && emailCadence !== null && emailCategories.has(category),
      },
    ] as const;
  });
  return {
    categories: Object.fromEntries(entries) as CategoryChannelMatrix,
    emailCadence,
    digestSchedule: savedDigestSchedule(preferences),
    disabledTypes: new Set(preferences?.disabledTypes ?? []),
  };
}

/**
 * The email timing to show a recipient. A digest chosen before digests had a
 * time is shown with the default time and reported as unscheduled.
 */
export function emailScheduleChoice(
  preferences: Doc<"notificationPreferences"> | null,
): { schedule: EmailSchedule; unscheduled: boolean } {
  const saved = savedDigestSchedule(preferences);
  if (saved) return { schedule: saved, unscheduled: false };
  const timezone = preferences?.timezone ?? "UTC";
  switch (preferences?.emailDigestFrequency) {
    case "daily":
      return {
        schedule: { cadence: "daily", time: DEFAULT_DIGEST_TIME, timezone },
        unscheduled: true,
      };
    case "weekly":
      return {
        schedule: {
          cadence: "weekly",
          day: DEFAULT_DIGEST_DAY,
          time: DEFAULT_DIGEST_TIME,
          timezone,
        },
        unscheduled: true,
      };
    default:
      return { schedule: { cadence: "instant" }, unscheduled: false };
  }
}

/**
 * Stored fields that replace a recipient's whole category matrix and email
 * timing. The cadence is kept when no category is emailed, and an instant
 * choice keeps the last digest time for when a digest is chosen again.
 */
export function preferenceFieldsFor(
  matrix: CategoryChannelMatrix,
  schedule: EmailSchedule,
) {
  const emailCategories = NOTIFICATION_CATEGORIES.filter(
    (category) => matrix[category].enabled && matrix[category].email,
  );
  const fields = {
    enableApprovals: matrix.approvals.enabled,
    enableReminders: matrix.reminders.enabled,
    enableAlerts: matrix.alerts.enabled,
    enableAssignments: matrix.assignments.enabled,
    enableSystem: matrix.system.enabled,
    emailCategories,
    emailEnabled: emailCategories.length > 0,
    emailDigestFrequency: schedule.cadence,
  };
  if (schedule.cadence === "instant") return fields;
  return {
    ...fields,
    emailDigestTime: schedule.time,
    emailDigestDay: schedule.cadence === "weekly" ? schedule.day : undefined,
    timezone: schedule.timezone,
  };
}

export async function storedPreferences(
  ctx: QueryCtx,
  userId: Id<"users">,
  organizationId: Id<"organizations">,
) {
  return await ctx.db
    .query("notificationPreferences")
    .withIndex("by_user_and_organization", (q) =>
      q.eq("userId", userId).eq("organizationId", organizationId),
    )
    .first();
}
