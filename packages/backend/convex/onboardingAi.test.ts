import { convexTest } from "convex-test";
import { afterEach, describe, expect, test, vi } from "vitest";
import { createConvexTestWithRateLimiter } from "../tests/testHarness";
import { modules } from "../tests/testSetup";
import { api } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import { SUGGESTION_REQUEST_BURST } from "./onboardingAi";
import schema from "./schema";
import { isSuggestionsRateLimited } from "./utils/collectionSuggestionErrors";
import {
  boundedSuggestionInput,
  buildTemplateCollectionSuggestions,
  COLLECTION_DESCRIPTION_MAX_LENGTH,
  parseCollectionSetupSuggestionJson,
} from "./utils/onboardingCollectionSuggestions";

afterEach(() => {
  vi.useRealTimers();
});

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
    const t = createConvexTestWithRateLimiter();
    const userId = await t.run(async (ctx) => {
      return await ctx.db.insert("users", {
        name: "Suggest User",
        email: `suggest-${Math.random().toString(36).slice(2, 8)}@test.dev`,
      });
    });
    const authed = authedForUser(t, userId);

    const result = await authed.action(
      api.onboardingAi.generateCollectionSuggestions,
      {
        organizationName: "Harbor Gallery",
        organizationType: "gallery",
        description: "Contemporary painting and photography.",
      },
    );

    expect(result.source).toBe("template");
    expect(result.collectionGroups.length).toBeGreaterThan(0);
  });

  test("the model sees a trimmed, capped request", () => {
    const input = boundedSuggestionInput({
      organizationName: `  ${"N".repeat(300)}  `,
      organizationType: "library",
      description: `  ${"d".repeat(COLLECTION_DESCRIPTION_MAX_LENGTH + 500)}`,
    });

    expect(input.organizationName).toHaveLength(200);
    expect(input.description).toHaveLength(COLLECTION_DESCRIPTION_MAX_LENGTH);
    expect(input.organizationType).toBe("library");
  });

  test("one user's suggestion requests are limited, then recover", async () => {
    vi.useFakeTimers();
    const t = createConvexTestWithRateLimiter();
    const [busyUserId, otherUserId] = await t.run(async (ctx) =>
      Promise.all(
        ["busy", "other"].map((name) =>
          ctx.db.insert("users", { name, email: `${name}@test.dev` }),
        ),
      ),
    );
    const request = {
      organizationName: "Harbor Gallery",
      organizationType: "gallery" as const,
      description: "Contemporary painting and photography.",
    };
    const busy = authedForUser(t, busyUserId!);

    for (let asked = 0; asked < SUGGESTION_REQUEST_BURST; asked++) {
      await busy.action(
        api.onboardingAi.generateCollectionSuggestions,
        request,
      );
    }
    const refusal = await busy
      .action(api.onboardingAi.generateCollectionSuggestions, request)
      .then(
        () => null,
        (error: unknown) => error,
      );
    expect(isSuggestionsRateLimited(refusal)).toBe(true);

    const other = await authedForUser(t, otherUserId!).action(
      api.onboardingAi.generateCollectionSuggestions,
      request,
    );
    expect(other.source).toBe("template");

    vi.advanceTimersByTime(6 * 60 * 1000);
    const recovered = await busy.action(
      api.onboardingAi.generateCollectionSuggestions,
      request,
    );
    expect(recovered.source).toBe("template");
  });
});
