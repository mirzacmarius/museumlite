import { HOUR, MINUTE, RateLimiter } from "@convex-dev/rate-limiter";
import { v } from "convex/values";
import { components, internal } from "./_generated/api";
import { action } from "./_generated/server";
import { env } from "./env";
import {
  isEmailAddress,
  NEWSLETTER_USER_GROUP_MAX_LENGTH,
  TOUR_REQUEST_FIELD_MAX_LENGTH,
} from "./utils/marketingForms";
import { internalMutation } from "./utils/mutationBuilders";

/**
 * The marketing forms need no sign-in, so each is limited per email address
 * (nobody's inbox is flooded) and overall (nobody fills the inquiry table or
 * the mailing list).
 */
export const SUBMISSIONS_PER_EMAIL_PER_HOUR = 3;
const marketingLimiter = new RateLimiter(components.rateLimiter, {
  newsletterSignupsPerEmail: {
    kind: "token bucket",
    rate: SUBMISSIONS_PER_EMAIL_PER_HOUR,
    period: HOUR,
  },
  newsletterSignups: {
    kind: "token bucket",
    rate: 30,
    period: MINUTE,
    capacity: 60,
  },
  tourRequestsPerEmail: {
    kind: "token bucket",
    rate: SUBMISSIONS_PER_EMAIL_PER_HOUR,
    period: HOUR,
  },
  tourRequests: {
    kind: "token bucket",
    rate: 10,
    period: MINUTE,
    capacity: 20,
  },
});

const FORM_LIMITS = {
  newsletter: {
    perEmail: "newsletterSignupsPerEmail",
    overall: "newsletterSignups",
  },
  tourRequest: { perEmail: "tourRequestsPerEmail", overall: "tourRequests" },
} as const;

/**
 * Whether one more submission of a form may go through. The address is
 * checked first, so repeating one address never spends the overall budget.
 */
export const admitMarketingSubmission = internalMutation({
  args: {
    form: v.union(v.literal("newsletter"), v.literal("tourRequest")),
    email: v.string(),
  },
  returns: v.boolean(),
  handler: async (ctx, args) => {
    const limits = FORM_LIMITS[args.form];
    const perEmail = await marketingLimiter.limit(ctx, limits.perEmail, {
      key: args.email,
    });
    if (!perEmail.ok) return false;
    const overall = await marketingLimiter.limit(ctx, limits.overall);
    return overall.ok;
  },
});

export const subscribe = action({
  args: {
    email: v.string(),
    userGroup: v.string(),
  },
  returns: v.union(
    v.object({ ok: v.literal(true) }),
    v.object({
      ok: v.literal(false),
      error: v.union(
        v.literal("invalid_input"),
        v.literal("rate_limited"),
        v.literal("unavailable"),
      ),
    }),
  ),
  handler: async (ctx, args) => {
    const email = args.email.trim().toLowerCase();
    const userGroup = args.userGroup.trim();
    if (
      !isEmailAddress(email) ||
      userGroup.length > NEWSLETTER_USER_GROUP_MAX_LENGTH
    ) {
      return { ok: false as const, error: "invalid_input" as const };
    }

    const formId = env.LOOPS_FORM_ID;
    if (!formId) {
      return { ok: false as const, error: "unavailable" as const };
    }

    const admitted = await ctx.runMutation(
      internal.web.admitMarketingSubmission,
      { form: "newsletter", email },
    );
    if (!admitted) {
      return { ok: false as const, error: "rate_limited" as const };
    }

    // The provider's reply stays here: callers learn only whether it worked.
    try {
      const res = await fetch(
        `https://app.loops.so/api/newsletter-form/${encodeURIComponent(formId)}`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ email, userGroup }),
        },
      );
      if (res.ok) return { ok: true as const };
    } catch {
      // Network failures read the same as a refusal from the provider.
    }
    return { ok: false as const, error: "unavailable" as const };
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
    const collectionSize = args.collectionSize?.trim();
    const message = args.message?.trim();

    if (!name || !institution || !email) {
      throw new Error("Name, institution, and email are required.");
    }

    if (!isEmailAddress(email)) {
      throw new Error("Please provide a valid email address.");
    }

    const limits = TOUR_REQUEST_FIELD_MAX_LENGTH;
    if (
      name.length > limits.name ||
      institution.length > limits.institution ||
      (collectionSize?.length ?? 0) > limits.collectionSize ||
      (message?.length ?? 0) > limits.message
    ) {
      throw new Error("One of the fields is too long.");
    }

    const admitted = await ctx.runMutation(
      internal.web.admitMarketingSubmission,
      { form: "tourRequest", email },
    );
    if (!admitted) {
      throw new Error("Too many requests. Please try again later.");
    }

    await ctx.runMutation(internal.web.insertTourRequest, {
      name,
      institution,
      email,
      collectionSize,
      message,
    });

    return { ok: true as const };
  },
});
