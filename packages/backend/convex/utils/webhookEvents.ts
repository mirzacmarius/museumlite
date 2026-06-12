import { internal } from "../_generated/api";
import type { Id } from "../_generated/dataModel";
import type { MutationCtx } from "../_generated/server";

export async function emitWebhookEvent(
  ctx: MutationCtx,
  organizationId: Id<"organizations">,
  event: string,
  data: Record<string, unknown>,
): Promise<void> {
  const hooks = await ctx.runQuery(internal.webhooks.getActiveForEvent, {
    organizationId,
    event,
  });
  if (hooks.length === 0) {
    return;
  }

  await ctx.scheduler.runAfter(0, internal.webhooksActions.deliver, {
    organizationId,
    event,
    data,
  });
}
