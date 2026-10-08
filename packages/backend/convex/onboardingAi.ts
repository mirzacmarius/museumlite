"use node";

import { getAuthUserId } from "@convex-dev/auth/server";
import { v } from "convex/values";
import { action } from "./_generated/server";
import {
  buildTemplateCollectionSuggestions,
  type CollectionSetupSuggestion,
  type OrganizationType,
  parseCollectionSetupSuggestionJson,
} from "./utils/onboardingCollectionSuggestions";

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

async function generateWithOpenAi(args: {
  organizationName: string;
  organizationType: OrganizationType;
  description: string;
}): Promise<CollectionSetupSuggestion | null> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return null;

  const OpenAI = (await import("openai")).default;
  const openai = new OpenAI({ apiKey });
  const response = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    temperature: 0.4,
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
  });

  const content = response.choices[0]?.message?.content;
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

    const trimmedName = args.organizationName.trim();
    if (!trimmedName) {
      throw new Error("Organization name is required");
    }

    const input = {
      organizationName: trimmedName,
      organizationType: args.organizationType as OrganizationType,
      description: args.description,
    };

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
