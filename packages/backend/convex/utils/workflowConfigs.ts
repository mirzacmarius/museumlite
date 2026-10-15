import type { GenericQueryCtx } from "convex/server";
import type { DataModel, Doc, Id } from "../_generated/dataModel";

type WorkflowConfigLookupCtx = Pick<GenericQueryCtx<DataModel>, "db">;

export type WorkflowType = Doc<"workflowConfigs">["workflowType"];

export async function getWorkflowConfig(
  ctx: WorkflowConfigLookupCtx,
  organizationId: Id<"organizations">,
  workflowType: WorkflowType,
) {
  return await ctx.db
    .query("workflowConfigs")
    .withIndex("by_organization_and_workflowType", (q) =>
      q.eq("organizationId", organizationId).eq("workflowType", workflowType),
    )
    .first();
}

export async function isDeaccessionWorkflowEnabled(
  ctx: WorkflowConfigLookupCtx,
  organizationId: Id<"organizations">,
) {
  const organization = await ctx.db.get(organizationId);
  return organization?.settings?.deaccessionWorkflowEnabled ?? true;
}
