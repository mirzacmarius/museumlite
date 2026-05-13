import type { Id } from "../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../_generated/server";

type RecipientCtx = MutationCtx | QueryCtx;

type WorkflowHistoryEntry = {
  step: number;
  approvedBy: Id<"users">;
};

function excludeActor(userIds: Iterable<Id<"users">>, actorId: Id<"users">) {
  return [...new Set(userIds)].filter((userId) => userId !== actorId);
}

export function getWorkflowCreatorRecipient(
  workflowHistory: readonly WorkflowHistoryEntry[] | undefined,
  actorId: Id<"users">,
) {
  const creatorId = workflowHistory?.find(
    (entry) => entry.step === 0,
  )?.approvedBy;

  return creatorId && creatorId !== actorId ? creatorId : null;
}

export async function getOrganizationNotificationRecipients(
  ctx: RecipientCtx,
  organizationId: Id<"organizations">,
  actorId: Id<"users">,
) {
  const userOrganizations = await ctx.db
    .query("userOrganizations")
    .withIndex("by_organization", (q) => q.eq("organizationId", organizationId))
    .collect();

  return excludeActor(
    userOrganizations.map((userOrganization) => userOrganization.userId),
    actorId,
  );
}
