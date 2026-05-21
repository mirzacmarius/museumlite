import { internal } from "../_generated/api";
import type { Id } from "../_generated/dataModel";
import type { MutationCtx } from "../_generated/server";
import { getOrganizationNotificationRecipients } from "./notificationRecipients";

export interface AuditLogParams {
  organizationId: Id<"organizations">;
  userId: Id<"users">;
  action: string;
  entityType: string;
  entityId: string;
  changes?: Record<string, unknown>;
}

export interface OrganizationNotificationParams {
  organizationId: Id<"organizations">;
  userId: Id<"users">;
  type: string;
  title: string;
  message: string;
  relatedEntityType: string;
  relatedEntityId: string;
}

export async function logActionAndGetRecipients(
  ctx: MutationCtx,
  params: AuditLogParams,
): Promise<Set<Id<"users">>> {
  const [, recipients] = await Promise.all([
    ctx.runMutation(internal.audit.logAction, params),
    getOrganizationNotificationRecipients(
      ctx,
      params.organizationId,
      params.userId,
    ),
  ] as const);

  return recipients;
}

export async function notifyOrganizationRecipients(
  ctx: MutationCtx,
  recipients: Iterable<Id<"users">>,
  params: OrganizationNotificationParams,
): Promise<void> {
  await Promise.all(
    Array.from(recipients).map((recipientId) =>
      ctx.runMutation(internal.audit.createNotificationInternal, {
        ...params,
        userId: recipientId,
      }),
    ),
  );
}
