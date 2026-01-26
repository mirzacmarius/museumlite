import { v } from "convex/values";
import { internalQuery } from "./_generated/server";

export const getAllOrganizations = internalQuery({
  args: {},
  returns: v.array(v.object({
    _id: v.id("organizations"),
    name: v.string(),
    type: v.string(),
  })),
  handler: async (ctx) => {
    const orgs = await ctx.db.query("organizations").collect();
    return orgs.map(o => ({
      _id: o._id,
      name: o.name,
      type: o.type,
    }));
  },
});
