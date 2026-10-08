import { getAuthUserId } from "@convex-dev/auth/server";
import { v } from "convex/values";
import type { Id } from "./_generated/dataModel";
import { mutation } from "./utils/mutationBuilders";
import { requirePermission } from "./utils/permissions";

const suggestedCollectionGroupValidator = v.object({
  name: v.string(),
  description: v.string(),
});

export const applyCollectionSuggestions = mutation({
  args: {
    organizationId: v.id("organizations"),
    collectionGroups: v.array(suggestedCollectionGroupValidator),
  },
  returns: v.object({
    createdGroupIds: v.array(v.id("collectionGroups")),
  }),
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Not authenticated");
    }

    await requirePermission(ctx, args.organizationId, "collections.create");

    const createdGroupIds: Array<Id<"collectionGroups">> = [];

    for (const group of args.collectionGroups) {
      const name = group.name.trim();
      if (!name) continue;

      const groupId = await ctx.db.insert("collectionGroups", {
        organizationId: args.organizationId,
        name: name.slice(0, 120),
        description: group.description.trim() || undefined,
        createdAt: Date.now(),
        createdBy: userId,
        itemsCount: 0,
      });
      createdGroupIds.push(groupId);
    }

    return { createdGroupIds };
  },
});
