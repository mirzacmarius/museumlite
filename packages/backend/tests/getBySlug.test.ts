import { convexTest } from "convex-test";
import { expect, test } from "vitest";
import { api } from "../convex/_generated/api";
import schema from "../convex/schema";
import { modules } from "./testSetup";

test("getBySlug returns public-safe org projection", async () => {
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
        enabledIntegrations: ["slack"],
        portalSettings: { isEnabled: true, portalSlug: "gallery" },
        watermarkSettings: { isEnabled: true, text: "Museum" },
      },
    });
  });
  const result = await t.query(api.organizations.getBySlug, {
    slug: "test-museum",
  });
  expect(result?.name).toBe("Test Museum");
  expect(result?.settings?.portalSettings?.isEnabled).toBe(true);
  expect(result?.settings?.portalSettings?.portalSlug).toBe("gallery");
  expect(result).not.toHaveProperty("subscriptionTier");
  expect(result).not.toHaveProperty("ownerUserId");
  expect(result).not.toHaveProperty("parentOrganizationId");
  expect(result).not.toHaveProperty("rootOrganizationId");
  expect(result?.settings).not.toHaveProperty("enabledIntegrations");
  expect(result?.settings).not.toHaveProperty("watermarkSettings");
});
