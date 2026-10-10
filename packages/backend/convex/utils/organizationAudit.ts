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

export async function logActionAndGetRecipients(
  ctx: MutationCtx,
  params: AuditLogParams,
): Promise<Array<Id<"users">>> {
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
