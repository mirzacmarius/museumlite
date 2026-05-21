import { convexTest } from "convex-test";
import { expect, test } from "vitest";
import { api } from "../convex/_generated/api";
import type { Id } from "../convex/_generated/dataModel";
import schema from "../convex/schema";
import { modules } from "./testSetup";

function authedForUser(t: ReturnType<typeof convexTest>, userId: Id<"users">) {
  return t.withIdentity({
    subject: `${userId}|session-1`,
    issuer: "https://example.test",
  });
}

test("userPreferences.set is idempotent for unchanged values", async () => {
  const t = convexTest(schema, modules);

  const userId = await t.run(async (ctx) => {
    return await ctx.db.insert("users", {
      name: "Preference User",
      email: "preferences@example.com",
    });
  });

  const authed = authedForUser(t, userId);

  await authed.mutation(api.userPreferences.set, {
    key: "organization.activeOrgId",
    value: "org_123",
  });

  const beforeSecondSet = await t.run(async (ctx) => {
    return await ctx.db
      .query("userPreferences")
      .withIndex("by_user_and_key", (q) =>
        q.eq("userId", userId).eq("key", "organization.activeOrgId"),
      )
      .unique();
  });

  await authed.mutation(api.userPreferences.set, {
    key: "organization.activeOrgId",
    value: "org_123",
  });

  const afterSecondSet = await t.run(async (ctx) => {
    return await ctx.db
      .query("userPreferences")
      .withIndex("by_user_and_key", (q) =>
        q.eq("userId", userId).eq("key", "organization.activeOrgId"),
      )
      .unique();
  });

  expect(beforeSecondSet?._id).toBeDefined();
  expect(afterSecondSet?._id).toBe(beforeSecondSet?._id);
  expect(afterSecondSet?.updatedAt).toBe(beforeSecondSet?.updatedAt);
});
