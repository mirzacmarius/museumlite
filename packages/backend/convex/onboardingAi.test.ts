import { convexTest } from "convex-test";
import { describe, expect, test } from "vitest";
import { api } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import schema from "./schema";
import {
  buildTemplateCollectionSuggestions,
  parseCollectionSetupSuggestionJson,
} from "./utils/onboardingCollectionSuggestions";

import { modules } from "../tests/testSetup";

function authedForUser(t: ReturnType<typeof convexTest>, userId: Id<"users">) {
  return t.withIdentity({
    subject: `${userId}|session-1`,
    issuer: "https://example.test",
  });
}

describe("onboarding collection suggestions", () => {
  test("buildTemplateCollectionSuggestions returns groups for museum", () => {
    const result = buildTemplateCollectionSuggestions({
      organizationName: "City Museum",
      organizationType: "museum",
      description: "We focus on regional history and fine art.",
    });

    expect(result.source).toBe("template");
    expect(result.collectionGroups.length).toBeGreaterThan(0);
    expect(result.objectTypes.length).toBeGreaterThan(0);
    expect(result.summary).toContain("regional history");
  });

  test("parseCollectionSetupSuggestionJson validates AI payload", () => {
    const parsed = parseCollectionSetupSuggestionJson(
      JSON.stringify({
        summary: "Suggested structure for your holdings.",
        collectionGroups: [
          { name: "Photography", description: "Prints and negatives." },
        ],
        objectTypes: ["Photograph", "Negative"],
      }),
    );

    expect(parsed?.source).toBe("ai");
    expect(parsed?.collectionGroups[0]?.name).toBe("Photography");
  });

  test("applyCollectionSuggestions creates collection groups", async () => {
    const t = convexTest(schema, modules);
    const userId = await t.run(async (ctx) => {
      return await ctx.db.insert("users", {
        name: "Onboarding User",
        email: `onboarding-${Math.random().toString(36).slice(2, 8)}@test.dev`,
      });
    });
    const authed = authedForUser(t, userId);

    const organizationId = await authed.mutation(api.organizations.create, {
      name: "Onboarding Museum",
      slug: `onboard-${Math.random().toString(36).slice(2, 8)}`,
      type: "museum",
    });

    const { createdGroupIds } = await authed.mutation(
      api.onboardingAiMutations.applyCollectionSuggestions,
      {
        organizationId,
        collectionGroups: [
          {
            name: "Test Department",
            description: "Created during onboarding.",
          },
        ],
      },
    );

    expect(createdGroupIds).toHaveLength(1);

    const group = await t.run(async (ctx) => ctx.db.get(createdGroupIds[0]!));
    expect(group?.name).toBe("Test Department");
    expect(group?.organizationId).toBe(organizationId);
  });

  test("generateCollectionSuggestions uses template in tests", async () => {
    const t = convexTest(schema, modules);
    const userId = await t.run(async (ctx) => {
      return await ctx.db.insert("users", {
        name: "Suggest User",
        email: `suggest-${Math.random().toString(36).slice(2, 8)}@test.dev`,
      });
    });
    const authed = authedForUser(t, userId);

    const result = await authed.action(api.onboardingAi.generateCollectionSuggestions, {
      organizationName: "Harbor Gallery",
      organizationType: "gallery",
      description: "Contemporary painting and photography.",
    });

    expect(result.source).toBe("template");
    expect(result.collectionGroups.length).toBeGreaterThan(0);
  });
});
