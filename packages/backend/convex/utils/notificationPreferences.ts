import { v } from "convex/values";
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
  disabledTypes: ReadonlySet<string>;
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
    disabledTypes: new Set(preferences?.disabledTypes ?? []),
  };
}

/** Stored fields that replace a recipient's whole category matrix. */
export function preferenceFieldsFor(matrix: CategoryChannelMatrix) {
  const emailCategories = NOTIFICATION_CATEGORIES.filter(
    (category) => matrix[category].enabled && matrix[category].email,
  );
  return {
    enableApprovals: matrix.approvals.enabled,
    enableReminders: matrix.reminders.enabled,
    enableAlerts: matrix.alerts.enabled,
    enableAssignments: matrix.assignments.enabled,
    enableSystem: matrix.system.enabled,
    emailCategories,
    emailEnabled: emailCategories.length > 0,
    emailDigestFrequency:
      emailCategories.length > 0 ? ("instant" as const) : ("never" as const),
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
