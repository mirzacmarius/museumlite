import { internal } from "../_generated/api";
import type { Doc, Id } from "../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../_generated/server";
import { DELIVERY_MAX_ATTEMPTS, newDeliveryLedger } from "./deliveryLedger";
import { rolePermissionNames } from "./memberPermissions";
import { addToDigest } from "./notificationDigests";
import { notificationEmailChannel } from "./notificationEmailChannel";
import {
  type ChannelPolicy,
  channelPolicy,
  type EmailCadence,
  storedPreferences,
} from "./notificationPreferences";
import {
  NOTIFICATION_ENTITY_READ_PERMISSIONS,
  NOTIFICATION_TYPE_CATEGORIES,
  type NotificationCategory,
  type NotificationEntityType,
  type NotificationType,
} from "./notificationTypes";
import type { NotificationEmailDetails } from "./notificationValidators";

export interface NotificationDispatch {
  organizationId: Id<"organizations">;
  type: NotificationType;
  /** Candidate recipients; each is checked for membership and access. */
  recipients: Iterable<Id<"users">>;
  title: string;
  message: string;
  related?: { entityType: NotificationEntityType; entityId: string };
  /** Content for the richer loan and task email layouts. */
  email?: NotificationEmailDetails;
  /**
   * Names the logical event, unique within the organization. Dispatching the
   * same key again returns the first intent and notifies nobody.
   */
  idempotencyKey?: string;
}

export interface DispatchResult {
  intentId: Id<"notificationIntents">;
  /** True when the key was already dispatched and nothing was written. */
  duplicate: boolean;
}

async function findIntent(
  ctx: QueryCtx | MutationCtx,
  organizationId: Id<"organizations">,
  idempotencyKey: string,
) {
  return await ctx.db
    .query("notificationIntents")
    .withIndex("by_organizationId_and_idempotencyKey", (q) =>
      q
        .eq("organizationId", organizationId)
        .eq("idempotencyKey", idempotencyKey),
    )
    .first();
}

/**
 * Whether an event with this idempotency key was already dispatched, so a
 * caller can skip working out its recipients.
 */
export async function wasDispatched(
  ctx: QueryCtx | MutationCtx,
  organizationId: Id<"organizations">,
  idempotencyKey: string,
) {
  return (await findIntent(ctx, organizationId, idempotencyKey)) !== null;
}

/**
 * The only way to notify staff (ADR 0007). Records the intent, checks every
 * recipient's membership and read access to the related entity, then applies
 * their category and channel choices: in-app for an enabled category, plus
 * a durable email delivery when they chose instant email for it, or a place
 * in their next digest when they chose a daily or weekly digest (ADR 0010).
 */
export async function dispatchNotification(
  ctx: MutationCtx,
  dispatch: NotificationDispatch,
): Promise<DispatchResult> {
  const { idempotencyKey } = dispatch;
  if (idempotencyKey !== undefined) {
    const existing = await findIntent(
      ctx,
      dispatch.organizationId,
      idempotencyKey,
    );
    if (existing) {
      return { intentId: existing._id, duplicate: true };
    }
  }

  const category = NOTIFICATION_TYPE_CATEGORIES[dispatch.type];
  const intentId = await ctx.db.insert("notificationIntents", {
    organizationId: dispatch.organizationId,
    type: dispatch.type,
    category,
    title: dispatch.title,
    message: dispatch.message,
    relatedEntityType: dispatch.related?.entityType,
    relatedEntityId: dispatch.related?.entityId,
    emailDetails: dispatch.email,
    idempotencyKey,
  });
  const access = recipientAccess(ctx, dispatch.organizationId);
  const readPermission = dispatch.related
    ? NOTIFICATION_ENTITY_READ_PERMISSIONS[dispatch.related.entityType]
    : null;
  const emailAvailable = notificationEmailChannel().kind !== "unavailable";
  const now = Date.now();
  let emailsQueued = 0;

  for (const userId of new Set(dispatch.recipients)) {
    const recipient = await access.check(userId, readPermission);
    if (recipient.kind !== "allowed") continue;
    const policy = channelPolicy(
      await storedPreferences(ctx, userId, dispatch.organizationId),
    );
    if (!notifies(policy, category, dispatch.type)) continue;

    const notificationId = await ctx.db.insert("notifications", {
      organizationId: dispatch.organizationId,
      userId,
      type: dispatch.type,
      title: dispatch.title,
      message: dispatch.message,
      read: false,
      relatedEntityType: dispatch.related?.entityType,
      relatedEntityId: dispatch.related?.entityId,
      createdAt: now,
      intentId,
    });

    const cadence = emailCadence(policy, category, dispatch.type);
    if (cadence === null || !emailAvailable || !recipient.user.email) continue;
    if (cadence === "instant") {
      await ctx.db.insert("notificationEmailDeliveries", {
        kind: "instant",
        organizationId: dispatch.organizationId,
        intentId,
        userId,
        notificationId,
        ...newDeliveryLedger(DELIVERY_MAX_ATTEMPTS, now),
      });
      emailsQueued++;
    } else if (policy.digestSchedule) {
      await addToDigest(
        ctx,
        { organizationId: dispatch.organizationId, userId, notificationId },
        policy.digestSchedule,
        now,
      );
    }
  }

  if (emailsQueued > 0) {
    await ctx.scheduler.runAfter(
      0,
      internal.notificationEmails.dispatchIntent,
      {
        intentId,
      },
    );
  }
  return { intentId, duplicate: false };
}

/** Whether a recipient's choices let this type reach them at all. */
export function notifies(
  policy: ChannelPolicy,
  category: NotificationCategory,
  type: string,
) {
  return policy.categories[category].enabled && !policy.disabledTypes.has(type);
}

/** How this type is emailed to the recipient, or null when it is not. */
export function emailCadence(
  policy: ChannelPolicy,
  category: NotificationCategory,
  type: string,
): EmailCadence | null {
  return notifies(policy, category, type) && policy.categories[category].email
    ? policy.emailCadence
    : null;
}

export type RecipientCheck =
  | { kind: "allowed"; user: Doc<"users"> }
  | { kind: "not_member" }
  | { kind: "no_access" };

/**
 * Membership and role permissions of candidate recipients, read once per
 * recipient and once per role, so organization-wide notifications and
 * digests of many notifications stay within transaction limits.
 */
export function recipientAccess(
  ctx: QueryCtx,
  organizationId: Id<"organizations">,
) {
  const permissionsByRole = new Map<
    Id<"roles">,
    Promise<ReadonlySet<string>>
  >();
  const members = new Map<
    Id<"users">,
    Promise<{ user: Doc<"users">; roleId: Id<"roles"> } | null>
  >();
  async function loadMember(userId: Id<"users">) {
    const [user, membership] = await Promise.all([
      ctx.db.get(userId),
      ctx.db
        .query("userOrganizations")
        .withIndex("by_user_and_organization", (q) =>
          q.eq("userId", userId).eq("organizationId", organizationId),
        )
        .first(),
    ]);
    return user && user.deactivatedAt === undefined && membership
      ? { user, roleId: membership.roleId }
      : null;
  }
  return {
    async check(
      userId: Id<"users">,
      readPermission: string | null,
    ): Promise<RecipientCheck> {
      let member = members.get(userId);
      if (!member) {
        member = loadMember(userId);
        members.set(userId, member);
      }
      const recipient = await member;
      if (!recipient) {
        return { kind: "not_member" };
      }
      if (readPermission !== null) {
        let permissions = permissionsByRole.get(recipient.roleId);
        if (!permissions) {
          permissions = rolePermissionNames(ctx, recipient.roleId);
          permissionsByRole.set(recipient.roleId, permissions);
        }
        if (!(await permissions).has(readPermission)) {
          return { kind: "no_access" };
        }
      }
      return { kind: "allowed", user: recipient.user };
    },
  };
}
