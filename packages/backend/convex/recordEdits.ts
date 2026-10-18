import { v } from "convex/values";
import type { Id } from "./_generated/dataModel";
import { type QueryCtx, query } from "./_generated/server";
import {
  getCurrentUserOrganization,
  requireCapability,
  requirePermission,
} from "./utils/permissions";
import {
  loanEditVersion,
  objectDraftEditVersion,
  objectEditVersion,
} from "./utils/recordEdits";

const editTargetValidator = v.union(
  v.object({ type: v.literal("object"), id: v.id("collections") }),
  v.object({ type: v.literal("objectDraft"), id: v.id("accessions") }),
  v.object({ type: v.literal("loan"), id: v.id("loans") }),
);

/** Members only: another organization's record reads as missing. */
async function isMember(
  ctx: QueryCtx,
  organizationId: Id<"organizations">,
): Promise<boolean> {
  return (await getCurrentUserOrganization(ctx, organizationId)) !== null;
}

/**
 * The version a form starts editing from. Saves pass it back as
 * `expectedEditVersion` and are refused with EDIT_CONFLICT once anyone has
 * changed what the form edits.
 */
export const getEditState = query({
  args: { target: editTargetValidator },
  returns: v.union(v.object({ editVersion: v.string() }), v.null()),
  handler: async (ctx, { target }) => {
    switch (target.type) {
      case "object": {
        const collection = await ctx.db.get(target.id);
        if (!collection || !(await isMember(ctx, collection.organizationId)))
          return null;
        await requirePermission(
          ctx,
          collection.organizationId,
          "collections.read",
        );
        return { editVersion: await objectEditVersion(ctx, collection) };
      }
      case "objectDraft": {
        const accession = await ctx.db.get(target.id);
        if (!accession || !(await isMember(ctx, accession.organizationId)))
          return null;
        await requirePermission(
          ctx,
          accession.organizationId,
          "collections.read",
        );
        return { editVersion: await objectDraftEditVersion(accession) };
      }
      case "loan": {
        const loan = await ctx.db.get(target.id);
        if (!loan || !(await isMember(ctx, loan.organizationId))) return null;
        await requireCapability(
          ctx,
          loan.organizationId,
          "loans",
          "loans.read",
        );
        return { editVersion: await loanEditVersion(loan) };
      }
    }
  },
});
