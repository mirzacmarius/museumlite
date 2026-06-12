import { convexTest } from "convex-test";
import { expect, test } from "vitest";
import { api } from "../convex/_generated/api";
import schema from "../convex/schema";
import { modules } from "./testSetup";

test("getBySlug returns org without validation error", async () => {
  const t = convexTest(schema, modules);
  await t.run(async (ctx) => {
    const userId = await ctx.db.insert("users", { email: "curator@example.com" });
    await ctx.db.insert("organizations", {
      name: "Test Museum",
      slug: "test-museum",
      type: "museum",
      subscriptionTier: "pro",
      ownerUserId: userId,
      isActive: true,
      accountNumber: "ORG-001",
      allowsIncomingTransferRequests: true,
      settings: {
        portalSettings: { isEnabled: true, portalSlug: "gallery" },
        watermarkSettings: { isEnabled: true, text: "Museum" },
      },
    });
  });
  const result = await t.query(api.organizations.getBySlug, {
    slug: "test-museum",
  });
  expect(result?.name).toBe("Test Museum");
});
