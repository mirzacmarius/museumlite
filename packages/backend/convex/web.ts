import { v } from "convex/values";
import { internal } from "./_generated/api";
import { action } from "./_generated/server";
import { env } from "./env";
import { internalMutation } from "./utils/mutationBuilders";

export const subscribe = action({
  args: {
    email: v.string(),
    userGroup: v.string(),
  },
  returns: v.any(),
  handler: async (_ctx, args) => {
    const res = await fetch(
      `https://app.loops.so/api/newsletter-form/${env.LOOPS_FORM_ID}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email: args.email,
          userGroup: args.userGroup,
        }),
      },
    );

    const json = await res.json();

    return json;
  },
});

export const insertTourRequest = internalMutation({
  args: {
    name: v.string(),
    institution: v.string(),
    email: v.string(),
    collectionSize: v.optional(v.string()),
    message: v.optional(v.string()),
  },
  returns: v.id("marketingInquiries"),
  handler: async (ctx, args) => {
    return await ctx.db.insert("marketingInquiries", {
      name: args.name.trim(),
      institution: args.institution.trim(),
      email: args.email.trim().toLowerCase(),
      collectionSize: args.collectionSize?.trim(),
      message: args.message?.trim(),
      createdAt: Date.now(),
    });
  },
});

export const submitTourRequest = action({
  args: {
    name: v.string(),
    institution: v.string(),
    email: v.string(),
    collectionSize: v.optional(v.string()),
    message: v.optional(v.string()),
  },
  returns: v.object({ ok: v.literal(true) }),
  handler: async (ctx, args) => {
    const name = args.name.trim();
    const institution = args.institution.trim();
    const email = args.email.trim().toLowerCase();

    if (!name || !institution || !email) {
      throw new Error("Name, institution, and email are required.");
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      throw new Error("Please provide a valid email address.");
    }

    await ctx.runMutation(internal.web.insertTourRequest, {
      name,
      institution,
      email,
      collectionSize: args.collectionSize?.trim(),
      message: args.message?.trim(),
    });

    return { ok: true as const };
  },
});
