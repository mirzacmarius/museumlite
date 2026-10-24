"use node";

import { getAuthUserId } from "@convex-dev/auth/server";
import { HOUR, RateLimiter } from "@convex-dev/rate-limiter";
import { v } from "convex/values";
import type { ChatCompletionCreateParamsNonStreaming } from "openai/resources/chat/completions";
import { components } from "./_generated/api";
import { action } from "./_generated/server";
import { suggestionsRateLimited } from "./utils/collectionSuggestionErrors";
import {
  boundedSuggestionInput,
  buildTemplateCollectionSuggestions,
  type CollectionSetupSuggestion,
  type OrganizationType,
  parseCollectionSetupSuggestionJson,
} from "./utils/onboardingCollectionSuggestions";

/** Suggestion requests one user may make: a few retries, then one every 6 minutes. */
export const SUGGESTION_REQUESTS_PER_HOUR = 10;
export const SUGGESTION_REQUEST_BURST = 5;
const suggestionLimiter = new RateLimiter(components.rateLimiter, {
  collectionSuggestions: {
    kind: "token bucket",
    rate: SUGGESTION_REQUESTS_PER_HOUR,
    period: HOUR,
    capacity: SUGGESTION_REQUEST_BURST,
  },
});

const organizationTypeValidator = v.union(
  v.literal("museum"),
  v.literal("gallery"),
  v.literal("library"),
  v.literal("collector"),
);

const suggestedCollectionGroupValidator = v.object({
  name: v.string(),
  description: v.string(),
});

const collectionSetupSuggestionValidator = v.object({
  summary: v.string(),
  collectionGroups: v.array(suggestedCollectionGroupValidator),
  objectTypes: v.array(v.string()),
  source: v.union(v.literal("ai"), v.literal("template")),
});

/** Room for a summary, 8 groups and 12 object types; a longer reply is cut off. */
export const SUGGESTION_MAX_OUTPUT_TOKENS = 1500;

/** The model request for one set of suggestions, built from bounded input. */
export function collectionSuggestionRequest(args: {
  organizationName: string;
  organizationType: OrganizationType;
  description: string;
}): ChatCompletionCreateParamsNonStreaming {
  return {
    model: "gpt-4o-mini",
    temperature: 0.4,
    max_completion_tokens: SUGGESTION_MAX_OUTPUT_TOKENS,
    response_format: { type: "json_object" },
    messages: [
      {
        role: "system",
        content: [
          "You help museums, galleries, libraries, and private collectors set up collection management software.",
          "Respond with JSON only using this shape:",
          '{"summary":"string","collectionGroups":[{"name":"string","description":"string"}],"objectTypes":["string"]}',
          "Suggest 2-6 practical collection groups (departments or groupings), not individual objects.",
          "objectTypes should be common catalog object types for the institution.",
          "Keep names concise and descriptions under 200 characters.",
        ].join(" "),
      },
      {
        role: "user",
        content: [
          `Organization name: ${args.organizationName}`,
          `Organization type: ${args.organizationType}`,
          `User description: ${args.description.trim() || "(no additional details)"}`,
        ].join("\n"),
      },
    ],
  };
}

async function generateWithOpenAi(args: {
  organizationName: string;
  organizationType: OrganizationType;
  description: string;
}): Promise<CollectionSetupSuggestion | null> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return null;

  const OpenAI = (await import("openai")).default;
  const openai = new OpenAI({ apiKey });
  const response = await openai.chat.completions.create(
    collectionSuggestionRequest(args),
  );

  // A reply cut off at the token cap is incomplete JSON; use the template.
  const choice = response.choices[0];
  if (!choice || choice.finish_reason === "length") return null;
  const content = choice.message?.content;
  if (!content) return null;

  return parseCollectionSetupSuggestionJson(content);
}

export const generateCollectionSuggestions = action({
  args: {
    organizationName: v.string(),
    organizationType: organizationTypeValidator,
    description: v.string(),
  },
  returns: collectionSetupSuggestionValidator,
  handler: async (ctx, args): Promise<CollectionSetupSuggestion> => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Not authenticated");
    }

    const input = boundedSuggestionInput({
      organizationName: args.organizationName,
      organizationType: args.organizationType as OrganizationType,
      description: args.description,
    });
    if (!input.organizationName) {
      throw new Error("Organization name is required");
    }

    const quota = await suggestionLimiter.limit(ctx, "collectionSuggestions", {
      key: userId,
    });
    if (!quota.ok) {
      throw suggestionsRateLimited(quota.retryAfter);
    }

    if (process.env.VITEST === "true" || process.env.NODE_ENV === "test") {
      return buildTemplateCollectionSuggestions(input);
    }

    try {
      const aiSuggestion = await generateWithOpenAi(input);
      if (aiSuggestion) return aiSuggestion;
    } catch {
      // Fall back to curated templates when the model or network fails.
    }

    return buildTemplateCollectionSuggestions(input);
  },
});
