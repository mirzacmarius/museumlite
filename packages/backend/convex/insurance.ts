import { getAuthUserId } from "@convex-dev/auth/server";
import { paginationOptsValidator } from "convex/server";
import { v } from "convex/values";
import { internal } from "./_generated/api";
import type { Doc, Id } from "./_generated/dataModel";
import {
  type MutationCtx,
  internalMutation,
  mutation,
  query,
} from "./_generated/server";
import { generateNextClaimNumber } from "./utils/numberGenerator";
import { createOrganizationQuery } from "./utils/convexAuth";
import { computeCoverageAlerts } from "./utils/insuranceCoverageAlerts";
import { computeInsuranceStats } from "./utils/insuranceStats";
import {
  getUserIdsWithPermission,
  requirePermission,
} from "./utils/permissions";

const insuranceReadQuery = createOrganizationQuery("loans.read");

const policyTypeValidator = v.union(
  v.literal("blanket"),
  v.literal("scheduled"),
  v.literal("exhibition"),
  v.literal("transit"),
  v.literal("loan"),
);

const policyStatusValidator = v.union(
  v.literal("active"),
  v.literal("pending"),
  v.literal("expired"),
  v.literal("cancelled"),
  v.literal("suspended"),
);

const premiumFrequencyValidator = v.union(
  v.literal("monthly"),
  v.literal("quarterly"),
  v.literal("semi_annual"),
  v.literal("annual"),
);

const coverageStatusValidator = v.union(
  v.literal("active"),
  v.literal("pending"),
  v.literal("expired"),
  v.literal("removed"),
);

const incidentTypeValidator = v.union(
  v.literal("damage"),
  v.literal("theft"),
  v.literal("loss"),
  v.literal("fire"),
  v.literal("water"),
  v.literal("vandalism"),
  v.literal("natural_disaster"),
  v.literal("transit"),
  v.literal("other"),
);

const claimStatusValidator = v.union(
  v.literal("draft"),
  v.literal("submitted"),
  v.literal("under_review"),
  v.literal("approved"),
  v.literal("denied"),
  v.literal("settled"),
  v.literal("closed"),
  v.literal("appealed"),
);

const payoutMethodValidator = v.union(
  v.literal("check"),
  v.literal("wire"),
  v.literal("repair_reimbursement"),
  v.literal("replacement"),
);

export const createPolicy = mutation({
  args: {
    organizationId: v.id("organizations"),
    policyNumber: v.string(),
    carrier: v.string(),
    carrierContact: v.optional(v.string()),
    carrierPhone: v.optional(v.string()),
    carrierEmail: v.optional(v.string()),
    policyType: policyTypeValidator,
    coverageAmount: v.number(),
    deductible: v.optional(v.number()),
    perItemLimit: v.optional(v.number()),
    premiumAmount: v.optional(v.number()),
    premiumFrequency: v.optional(premiumFrequencyValidator),
    nextPremiumDue: v.optional(v.number()),
    effectiveDate: v.number(),
    expirationDate: v.number(),
    renewalDate: v.optional(v.number()),
    autoRenew: v.optional(v.boolean()),
    territory: v.optional(v.string()),
    exclusions: v.optional(v.array(v.string())),
    notes: v.optional(v.string()),
  },
  returns: v.id("insurancePolicies"),
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Not authenticated");
    }

    await requirePermission(
      ctx,
      args.organizationId,
      "organization.manage_settings",
    );

    const existingPolicy = await ctx.db
      .query("insurancePolicies")
      .withIndex("by_organization_and_policyNumber", (q) =>
        q
          .eq("organizationId", args.organizationId)
          .eq("policyNumber", args.policyNumber),
      )
      .first();

    if (existingPolicy) {
      throw new Error("Policy number already exists");
    }

    const now = Date.now();
    let status: "active" | "pending" | "expired" =
      args.effectiveDate <= now ? "active" : "pending";
    if (args.expirationDate < now) {
      status = "expired";
    }

    const policyId = await ctx.db.insert("insurancePolicies", {
      organizationId: args.organizationId,
      policyNumber: args.policyNumber,
      carrier: args.carrier,
      carrierContact: args.carrierContact,
      carrierPhone: args.carrierPhone,
      carrierEmail: args.carrierEmail,
      policyType: args.policyType,
      coverageAmount: args.coverageAmount,
      deductible: args.deductible,
      perItemLimit: args.perItemLimit,
      premiumAmount: args.premiumAmount,
      premiumFrequency: args.premiumFrequency,
      nextPremiumDue: args.nextPremiumDue,
      effectiveDate: args.effectiveDate,
      expirationDate: args.expirationDate,
      renewalDate: args.renewalDate,
      autoRenew: args.autoRenew,
      status,
      territory: args.territory,
      exclusions: args.exclusions,
      notes: args.notes,
      createdBy: userId,
      createdAt: now,
    });

    await ctx.runMutation(internal.audit.logAction, {
      organizationId: args.organizationId,
      userId,
      action: "created",
      entityType: "insurancePolicy",
      entityId: policyId,
      changes: { policyNumber: args.policyNumber, carrier: args.carrier },
    });

    return policyId;
  },
});

export const updatePolicy = mutation({
  args: {
    policyId: v.id("insurancePolicies"),
    policyNumber: v.optional(v.string()),
    carrier: v.optional(v.string()),
    carrierContact: v.optional(v.string()),
    carrierPhone: v.optional(v.string()),
    carrierEmail: v.optional(v.string()),
    policyType: v.optional(policyTypeValidator),
    coverageAmount: v.optional(v.number()),
    deductible: v.optional(v.number()),
    perItemLimit: v.optional(v.number()),
    premiumAmount: v.optional(v.number()),
    premiumFrequency: v.optional(premiumFrequencyValidator),
    nextPremiumDue: v.optional(v.number()),
    effectiveDate: v.optional(v.number()),
    expirationDate: v.optional(v.number()),
    renewalDate: v.optional(v.number()),
    autoRenew: v.optional(v.boolean()),
    status: v.optional(policyStatusValidator),
    territory: v.optional(v.string()),
    exclusions: v.optional(v.array(v.string())),
    notes: v.optional(v.string()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Not authenticated");
    }

    const policy = await ctx.db.get(args.policyId);
    if (!policy) {
      throw new Error("Policy not found");
    }

    await requirePermission(
      ctx,
      policy.organizationId,
      "organization.manage_settings",
    );

    if (args.policyNumber && args.policyNumber !== policy.policyNumber) {
      const existingPolicy = await ctx.db
        .query("insurancePolicies")
        .withIndex("by_organization_and_policyNumber", (q) =>
          q
            .eq("organizationId", policy.organizationId)
            .eq("policyNumber", args.policyNumber as string),
        )
        .first();

      if (existingPolicy) {
        throw new Error("Policy number already exists");
      }
    }

    const { policyId, ...updates } = args;
    const filteredUpdates = Object.fromEntries(
      Object.entries(updates).filter(([_, v]) => v !== undefined),
    );

    await Promise.all([
      ctx.db.patch(args.policyId, {
      ...filteredUpdates,
      lastModifiedBy: userId,
      lastModifiedAt: Date.now(),
    }),
      ctx.runMutation(internal.audit.logAction, {
      organizationId: policy.organizationId,
      userId,
      action: "updated",
      entityType: "insurancePolicy",
      entityId: args.policyId,
      changes: filteredUpdates,
    }),
    ]);

    return null;
  },
});

export const deletePolicy = mutation({
  args: {
    policyId: v.id("insurancePolicies"),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Not authenticated");
    }

    const policy = await ctx.db.get(args.policyId);
    if (!policy) {
      throw new Error("Policy not found");
    }

    await requirePermission(
      ctx,
      policy.organizationId,
      "organization.manage_settings",
    );

    const activeCoverages = await ctx.db
      .query("insuranceCoverages")
      .withIndex("by_policy_and_status", (q) =>
        q.eq("policyId", args.policyId).eq("status", "active"),
      )
      .first();

    if (activeCoverages) {
      throw new Error("Cannot delete policy with active coverages");
    }

    const activeClaims = await ctx.db
      .query("insuranceClaims")
      .withIndex("by_policy", (q) => q.eq("policyId", args.policyId))
      .filter((q) =>
        q.or(
          q.eq(q.field("status"), "submitted"),
          q.eq(q.field("status"), "under_review"),
        ),
      )
      .first();

    if (activeClaims) {
      throw new Error("Cannot delete policy with active claims");
    }

    await Promise.all([
      ctx.db.delete(args.policyId),
      ctx.runMutation(internal.audit.logAction, {
      organizationId: policy.organizationId,
      userId,
      action: "deleted",
      entityType: "insurancePolicy",
      entityId: args.policyId,
      changes: { policyNumber: policy.policyNumber },
    }),
    ]);

    return null;
  },
});

export const listPolicies = insuranceReadQuery({
  args: {
    organizationId: v.id("organizations"),
    paginationOpts: paginationOptsValidator,
    status: v.optional(policyStatusValidator),
    policyType: v.optional(policyTypeValidator),
    search: v.optional(v.string()),
  },
  returns: v.object({
    page: v.array(
      v.object({
        _id: v.id("insurancePolicies"),
        policyNumber: v.string(),
        carrier: v.string(),
        policyType: policyTypeValidator,
        coverageAmount: v.number(),
        effectiveDate: v.number(),
        expirationDate: v.number(),
        status: policyStatusValidator,
        coverageCount: v.number(),
        claimsCount: v.number(),
      }),
    ),
    isDone: v.boolean(),
    continueCursor: v.string(),
  }),
  handler: async (ctx, args) => {
    const allPolicies: Array<Doc<"insurancePolicies">> = [];

    const policiesQuery = args.status
      ? ctx.db
          .query("insurancePolicies")
          .withIndex("by_organization_and_status", (q) =>
            q
              .eq("organizationId", ctx.organizationId)
              .eq("status", args.status!),
          )
      : ctx.db
          .query("insurancePolicies")
          .withIndex("by_organization", (q) =>
            q.eq("organizationId", ctx.organizationId),
          );

    for await (const policy of policiesQuery) {
      allPolicies.push(policy);
    }

    if (args.policyType) {
      allPolicies = allPolicies.filter((p) => p.policyType === args.policyType);
    }

    if (args.search && args.search.trim().length > 0) {
      const searchLower = args.search.toLowerCase();
      allPolicies = allPolicies.filter(
        (p) =>
          p.policyNumber.toLowerCase().includes(searchLower) ||
          p.carrier.toLowerCase().includes(searchLower),
      );
    }

    allPolicies.sort((a, b) => b.createdAt - a.createdAt);

    const cursor = args.paginationOpts.cursor
      ? Number.parseInt(args.paginationOpts.cursor, 10)
      : 0;
    const startIndex = cursor;
    const endIndex = Math.min(
      startIndex + args.paginationOpts.numItems,
      allPolicies.length,
    );
    const page = allPolicies.slice(startIndex, endIndex);

    const policiesWithCounts = await Promise.all(
      page.map(async (policy) => {
        const [coverages, claims] = await Promise.all([
          ctx.db
            .query("insuranceCoverages")
            .withIndex("by_policy_and_status", (q) =>
              q.eq("policyId", policy._id).eq("status", "active"),
            )
            .collect(),
          ctx.db
            .query("insuranceClaims")
            .withIndex("by_policy", (q) => q.eq("policyId", policy._id))
            .collect(),
        ] as const);
        return {
          _id: policy._id,
          policyNumber: policy.policyNumber,
          carrier: policy.carrier,
          policyType: policy.policyType,
          coverageAmount: policy.coverageAmount,
          effectiveDate: policy.effectiveDate,
          expirationDate: policy.expirationDate,
          status: policy.status,
          coverageCount: coverages.length,
          claimsCount: claims.length,
        };
      }),
    );

    return {
      page: policiesWithCounts,
      isDone: endIndex >= allPolicies.length,
      continueCursor: endIndex.toString(),
    };
  },
});

export const getPolicy = query({
  args: {
    policyId: v.id("insurancePolicies"),
  },
  returns: v.union(
    v.object({
      _id: v.id("insurancePolicies"),
      organizationId: v.id("organizations"),
      policyNumber: v.string(),
      carrier: v.string(),
      carrierContact: v.optional(v.string()),
      carrierPhone: v.optional(v.string()),
      carrierEmail: v.optional(v.string()),
      policyType: policyTypeValidator,
      coverageAmount: v.number(),
      deductible: v.optional(v.number()),
      perItemLimit: v.optional(v.number()),
      premiumAmount: v.optional(v.number()),
      premiumFrequency: v.optional(premiumFrequencyValidator),
      nextPremiumDue: v.optional(v.number()),
      effectiveDate: v.number(),
      expirationDate: v.number(),
      renewalDate: v.optional(v.number()),
      autoRenew: v.optional(v.boolean()),
      status: policyStatusValidator,
      territory: v.optional(v.string()),
      exclusions: v.optional(v.array(v.string())),
      documentIds: v.optional(v.array(v.id("_storage"))),
      documentUrls: v.optional(v.array(v.union(v.string(), v.null()))),
      notes: v.optional(v.string()),
      createdBy: v.id("users"),
      createdAt: v.number(),
      coverages: v.array(
        v.object({
          _id: v.id("insuranceCoverages"),
          collectionId: v.optional(v.id("collections")),
          collectionTitle: v.optional(v.string()),
          collectionAccessionNumber: v.optional(v.string()),
          exhibitionId: v.optional(v.id("exhibitions")),
          exhibitionTitle: v.optional(v.string()),
          loanId: v.optional(v.id("loans")),
          loanNumber: v.optional(v.string()),
          coveredValue: v.number(),
          status: coverageStatusValidator,
        }),
      ),
      claims: v.array(
        v.object({
          _id: v.id("insuranceClaims"),
          claimNumber: v.string(),
          incidentType: incidentTypeValidator,
          incidentDate: v.number(),
          claimedAmount: v.number(),
          status: claimStatusValidator,
        }),
      ),
    }),
    v.null(),
  ),
  handler: async (ctx, args) => {
    const policy = await ctx.db.get(args.policyId);
    if (!policy) {
      return null;
    }

    const [, documentUrls, coverages, claims] = await Promise.all([
      requirePermission(ctx, policy.organizationId, "loans.read"),
      policy.documentIds
        ? Promise.all(policy.documentIds.map((id) => ctx.storage.getUrl(id)))
        : Promise.resolve(undefined),
      ctx.db
        .query("insuranceCoverages")
        .withIndex("by_policy", (q) => q.eq("policyId", args.policyId))
        .collect(),
      ctx.db
        .query("insuranceClaims")
        .withIndex("by_policy", (q) => q.eq("policyId", args.policyId))
        .collect(),
    ] as const);

    const enrichedCoverages = await Promise.all(
      coverages.map(async (coverage) => {
        const [collection, exhibition, loan] = await Promise.all([
          coverage.collectionId
            ? ctx.db.get(coverage.collectionId)
            : Promise.resolve(null),
          coverage.exhibitionId
            ? ctx.db.get(coverage.exhibitionId)
            : Promise.resolve(null),
          coverage.loanId ? ctx.db.get(coverage.loanId) : Promise.resolve(null),
        ] as const);

        let collectionTitle: string | undefined;
        let collectionAccessionNumber: string | undefined;
        let exhibitionTitle: string | undefined;
        let loanNumber: string | undefined;

        if (collection) {
          collectionTitle = collection?.title;
          collectionAccessionNumber = collection?.accessionNumber;
        }

        if (exhibition) {
          exhibitionTitle = exhibition?.title;
        }

        if (loan) {
          loanNumber = loan?.loanNumber;
        }

        return {
          _id: coverage._id,
          collectionId: coverage.collectionId,
          collectionTitle,
          collectionAccessionNumber,
          exhibitionId: coverage.exhibitionId,
          exhibitionTitle,
          loanId: coverage.loanId,
          loanNumber,
          coveredValue: coverage.coveredValue,
          status: coverage.status,
        };
      }),
    );

    const enrichedClaims = claims.map((claim) => ({
      _id: claim._id,
      claimNumber: claim.claimNumber,
      incidentType: claim.incidentType,
      incidentDate: claim.incidentDate,
      claimedAmount: claim.claimedAmount,
      status: claim.status,
    }));

    return {
      _id: policy._id,
      organizationId: policy.organizationId,
      policyNumber: policy.policyNumber,
      carrier: policy.carrier,
      carrierContact: policy.carrierContact,
      carrierPhone: policy.carrierPhone,
      carrierEmail: policy.carrierEmail,
      policyType: policy.policyType,
      coverageAmount: policy.coverageAmount,
      deductible: policy.deductible,
      perItemLimit: policy.perItemLimit,
      premiumAmount: policy.premiumAmount,
      premiumFrequency: policy.premiumFrequency,
      nextPremiumDue: policy.nextPremiumDue,
      effectiveDate: policy.effectiveDate,
      expirationDate: policy.expirationDate,
      renewalDate: policy.renewalDate,
      autoRenew: policy.autoRenew,
      status: policy.status,
      territory: policy.territory,
      exclusions: policy.exclusions,
      documentIds: policy.documentIds,
      documentUrls,
      notes: policy.notes,
      createdBy: policy.createdBy,
      createdAt: policy.createdAt,
      coverages: enrichedCoverages,
      claims: enrichedClaims,
    };
  },
});

export const addCoverage = mutation({
  args: {
    policyId: v.id("insurancePolicies"),
    collectionId: v.optional(v.id("collections")),
    exhibitionId: v.optional(v.id("exhibitions")),
    loanId: v.optional(v.id("loans")),
    coveredValue: v.number(),
    effectiveDate: v.optional(v.number()),
    expirationDate: v.optional(v.number()),
    notes: v.optional(v.string()),
  },
  returns: v.id("insuranceCoverages"),
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Not authenticated");
    }

    const policy = await ctx.db.get(args.policyId);
    if (!policy) {
      throw new Error("Policy not found");
    }

    if (!args.collectionId && !args.exhibitionId && !args.loanId) {
      throw new Error(
        "Must specify at least one of: collectionId, exhibitionId, or loanId",
      );
    }

    await requirePermission(
      ctx,
      policy.organizationId,
      "organization.manage_settings",
    );

    const [collection, exhibition, loan] = await Promise.all([
      args.collectionId ? ctx.db.get(args.collectionId) : null,
      args.exhibitionId ? ctx.db.get(args.exhibitionId) : null,
      args.loanId ? ctx.db.get(args.loanId) : null,
    ]);

    if (args.collectionId) {
      if (!collection || collection.organizationId !== policy.organizationId) {
        throw new Error("Collection not found or belongs to different org");
      }
    }

    if (args.exhibitionId) {
      if (
        !exhibition ||
        exhibition.organizationId !== policy.organizationId
      ) {
        throw new Error("Exhibition not found or belongs to different org");
      }
    }

    if (args.loanId) {
      if (!loan || loan.organizationId !== policy.organizationId) {
        throw new Error("Loan not found or belongs to different org");
      }
    }

    const coverageId = await ctx.db.insert("insuranceCoverages", {
      organizationId: policy.organizationId,
      policyId: args.policyId,
      collectionId: args.collectionId,
      exhibitionId: args.exhibitionId,
      loanId: args.loanId,
      coveredValue: args.coveredValue,
      effectiveDate: args.effectiveDate,
      expirationDate: args.expirationDate,
      status: "active",
      notes: args.notes,
      createdBy: userId,
      createdAt: Date.now(),
    });

    await ctx.runMutation(internal.audit.logAction, {
      organizationId: policy.organizationId,
      userId,
      action: "created",
      entityType: "insuranceCoverage",
      entityId: coverageId,
      changes: {
        policyId: args.policyId,
        coveredValue: args.coveredValue,
      },
    });

    return coverageId;
  },
});

export const removeCoverage = mutation({
  args: {
    coverageId: v.id("insuranceCoverages"),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Not authenticated");
    }

    const coverage = await ctx.db.get(args.coverageId);
    if (!coverage) {
      throw new Error("Coverage not found");
    }
    await Promise.all([
      requirePermission(
        ctx,
        coverage.organizationId,
        "organization.manage_settings",
      ),
      ctx.db.patch(args.coverageId, {
        status: "removed",
      }),
      ctx.runMutation(internal.audit.logAction, {
        organizationId: coverage.organizationId,
        userId,
        action: "removed",
        entityType: "insuranceCoverage",
        entityId: args.coverageId,
        changes: { status: "removed" },
      }),
    ] as const);

    return null;
  },
});

export const getCoverageForObject = query({
  args: {
    collectionId: v.id("collections"),
  },
  returns: v.array(
    v.object({
      _id: v.id("insuranceCoverages"),
      policyId: v.id("insurancePolicies"),
      policyNumber: v.string(),
      carrier: v.string(),
      coveredValue: v.number(),
      effectiveDate: v.optional(v.number()),
      expirationDate: v.optional(v.number()),
      policyExpirationDate: v.number(),
      status: coverageStatusValidator,
    }),
  ),
  handler: async (ctx, args) => {
    const collection = await ctx.db.get(args.collectionId);
    if (!collection) {
      return [];
    }

    await requirePermission(ctx, collection.organizationId, "loans.read");

    const coverages = await ctx.db
      .query("insuranceCoverages")
      .withIndex("by_collection", (q) =>
        q.eq("collectionId", args.collectionId),
      )
      .filter((q) => q.eq(q.field("status"), "active"))
      .collect();

    const enrichedCoverages = await Promise.all(
      coverages.map(async (coverage) => {
        const policy = await ctx.db.get(coverage.policyId);
        return {
          _id: coverage._id,
          policyId: coverage.policyId,
          policyNumber: policy?.policyNumber ?? "",
          carrier: policy?.carrier ?? "",
          coveredValue: coverage.coveredValue,
          effectiveDate: coverage.effectiveDate,
          expirationDate: coverage.expirationDate,
          policyExpirationDate: policy?.expirationDate ?? 0,
          status: coverage.status,
        };
      }),
    );

    return enrichedCoverages;
  },
});

export const createClaim = mutation({
  args: {
    organizationId: v.id("organizations"),
    policyId: v.id("insurancePolicies"),
    collectionIds: v.optional(v.array(v.id("collections"))),
    exhibitionId: v.optional(v.id("exhibitions")),
    loanId: v.optional(v.id("loans")),
    incidentDate: v.number(),
    incidentLocation: v.optional(v.string()),
    incidentType: incidentTypeValidator,
    incidentDescription: v.string(),
    claimedAmount: v.number(),
    documentIds: v.optional(v.array(v.id("_storage"))),
    photoIds: v.optional(v.array(v.id("_storage"))),
    internalNotes: v.optional(v.string()),
  },
  returns: v.id("insuranceClaims"),
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Not authenticated");
    }

    const [, policy] = await Promise.all([
      requirePermission(
        ctx,
        args.organizationId,
        "organization.manage_settings",
      ),
      ctx.db.get(args.policyId),
    ] as const);
    if (!policy || policy.organizationId !== args.organizationId) {
      throw new Error("Policy not found or belongs to different org");
    }

    const claimNumber = await generateNextClaimNumber(ctx, args.organizationId);

    const claimId = await ctx.db.insert("insuranceClaims", {
      organizationId: args.organizationId,
      policyId: args.policyId,
      claimNumber,
      collectionIds: args.collectionIds,
      exhibitionId: args.exhibitionId,
      loanId: args.loanId,
      incidentDate: args.incidentDate,
      incidentLocation: args.incidentLocation,
      incidentType: args.incidentType,
      incidentDescription: args.incidentDescription,
      claimedAmount: args.claimedAmount,
      status: "draft",
      reportedDate: Date.now(),
      documentIds: args.documentIds,
      photoIds: args.photoIds,
      internalNotes: args.internalNotes,
      createdBy: userId,
      createdAt: Date.now(),
    });

    await ctx.runMutation(internal.audit.logAction, {
      organizationId: args.organizationId,
      userId,
      action: "created",
      entityType: "insuranceClaim",
      entityId: claimId,
      changes: { claimNumber, incidentType: args.incidentType },
    });

    return claimId;
  },
});

export const updateClaim = mutation({
  args: {
    claimId: v.id("insuranceClaims"),
    incidentLocation: v.optional(v.string()),
    incidentDescription: v.optional(v.string()),
    claimedAmount: v.optional(v.number()),
    assessedAmount: v.optional(v.number()),
    settledAmount: v.optional(v.number()),
    deductibleApplied: v.optional(v.number()),
    status: v.optional(claimStatusValidator),
    adjusterName: v.optional(v.string()),
    adjusterPhone: v.optional(v.string()),
    adjusterEmail: v.optional(v.string()),
    adjusterNotes: v.optional(v.string()),
    denialReason: v.optional(v.string()),
    payoutMethod: v.optional(payoutMethodValidator),
    payoutDate: v.optional(v.number()),
    payoutReference: v.optional(v.string()),
    internalNotes: v.optional(v.string()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Not authenticated");
    }

    const claim = await ctx.db.get(args.claimId);
    if (!claim) {
      throw new Error("Claim not found");
    }

    await requirePermission(
      ctx,
      claim.organizationId,
      "organization.manage_settings",
    );

    const { claimId, status, ...otherUpdates } = args;
    const updates: Record<string, unknown> = Object.fromEntries(
      Object.entries(otherUpdates).filter(([_, v]) => v !== undefined),
    );

    if (status) {
      updates.status = status;

      if (status === "submitted" && claim.status === "draft") {
        updates.submittedDate = Date.now();
      }

      if (status === "under_review" && !claim.reviewStartDate) {
        updates.reviewStartDate = Date.now();
      }

      if (
        (status === "approved" || status === "denied") &&
        !claim.decisionDate
      ) {
        updates.decisionDate = Date.now();
      }

      if (status === "settled" && !claim.settlementDate) {
        updates.settlementDate = Date.now();
      }
    }

    updates.lastModifiedBy = userId;
    updates.lastModifiedAt = Date.now();

    await Promise.all([
      ctx.db.patch(args.claimId, updates),
      ctx.runMutation(internal.audit.logAction, {
      organizationId: claim.organizationId,
      userId,
      action: "updated",
      entityType: "insuranceClaim",
      entityId: args.claimId,
      changes: updates,
    }),
    ]);

    return null;
  },
});

export const listClaims = insuranceReadQuery({
  args: {
    organizationId: v.id("organizations"),
    paginationOpts: paginationOptsValidator,
    status: v.optional(claimStatusValidator),
    policyId: v.optional(v.id("insurancePolicies")),
    search: v.optional(v.string()),
  },
  returns: v.object({
    page: v.array(
      v.object({
        _id: v.id("insuranceClaims"),
        claimNumber: v.string(),
        policyNumber: v.string(),
        carrier: v.string(),
        incidentType: incidentTypeValidator,
        incidentDate: v.number(),
        claimedAmount: v.number(),
        settledAmount: v.optional(v.number()),
        status: claimStatusValidator,
        reportedDate: v.number(),
      }),
    ),
    isDone: v.boolean(),
    continueCursor: v.string(),
  }),
  handler: async (ctx, args) => {
    let allClaims: Array<Doc<"insuranceClaims">> = [];

    const claimsQuery = args.status
      ? ctx.db
          .query("insuranceClaims")
          .withIndex("by_organization_and_status", (q) =>
            q
              .eq("organizationId", ctx.organizationId)
              .eq("status", args.status!),
          )
      : ctx.db
          .query("insuranceClaims")
          .withIndex("by_organization", (q) =>
            q.eq("organizationId", ctx.organizationId),
          );

    for await (const claim of claimsQuery) {
      allClaims.push(claim);
    }

    if (args.policyId) {
      allClaims = allClaims.filter((c) => c.policyId === args.policyId);
    }

    if (args.search && args.search.trim().length > 0) {
      const searchLower = args.search.toLowerCase();
      allClaims = allClaims.filter(
        (c) =>
          c.claimNumber.toLowerCase().includes(searchLower) ||
          c.incidentDescription.toLowerCase().includes(searchLower),
      );
    }

    allClaims.sort((a, b) => b.reportedDate - a.reportedDate);

    const cursor = args.paginationOpts.cursor
      ? Number.parseInt(args.paginationOpts.cursor, 10)
      : 0;
    const startIndex = cursor;
    const endIndex = Math.min(
      startIndex + args.paginationOpts.numItems,
      allClaims.length,
    );
    const page = allClaims.slice(startIndex, endIndex);

    const claimsWithPolicy = await Promise.all(
      page.map(async (claim) => {
        const policy = await ctx.db.get(claim.policyId);
        return {
          _id: claim._id,
          claimNumber: claim.claimNumber,
          policyNumber: policy?.policyNumber ?? "",
          carrier: policy?.carrier ?? "",
          incidentType: claim.incidentType,
          incidentDate: claim.incidentDate,
          claimedAmount: claim.claimedAmount,
          settledAmount: claim.settledAmount,
          status: claim.status,
          reportedDate: claim.reportedDate,
        };
      }),
    );

    return {
      page: claimsWithPolicy,
      isDone: endIndex >= allClaims.length,
      continueCursor: endIndex.toString(),
    };
  },
});

export const getClaim = query({
  args: {
    claimId: v.id("insuranceClaims"),
  },
  returns: v.union(
    v.object({
      _id: v.id("insuranceClaims"),
      organizationId: v.id("organizations"),
      policyId: v.id("insurancePolicies"),
      policyNumber: v.string(),
      carrier: v.string(),
      claimNumber: v.string(),
      collectionIds: v.optional(v.array(v.id("collections"))),
      collections: v.optional(
        v.array(
          v.object({
            _id: v.id("collections"),
            title: v.string(),
            accessionNumber: v.string(),
          }),
        ),
      ),
      exhibitionId: v.optional(v.id("exhibitions")),
      exhibitionTitle: v.optional(v.string()),
      loanId: v.optional(v.id("loans")),
      loanNumber: v.optional(v.string()),
      incidentDate: v.number(),
      incidentLocation: v.optional(v.string()),
      incidentType: incidentTypeValidator,
      incidentDescription: v.string(),
      claimedAmount: v.number(),
      assessedAmount: v.optional(v.number()),
      settledAmount: v.optional(v.number()),
      deductibleApplied: v.optional(v.number()),
      status: claimStatusValidator,
      reportedDate: v.number(),
      submittedDate: v.optional(v.number()),
      reviewStartDate: v.optional(v.number()),
      decisionDate: v.optional(v.number()),
      settlementDate: v.optional(v.number()),
      adjusterName: v.optional(v.string()),
      adjusterPhone: v.optional(v.string()),
      adjusterEmail: v.optional(v.string()),
      adjusterNotes: v.optional(v.string()),
      documentIds: v.optional(v.array(v.id("_storage"))),
      documentUrls: v.optional(v.array(v.union(v.string(), v.null()))),
      photoIds: v.optional(v.array(v.id("_storage"))),
      photoUrls: v.optional(v.array(v.union(v.string(), v.null()))),
      denialReason: v.optional(v.string()),
      payoutMethod: v.optional(payoutMethodValidator),
      payoutDate: v.optional(v.number()),
      payoutReference: v.optional(v.string()),
      internalNotes: v.optional(v.string()),
      createdBy: v.id("users"),
      createdAt: v.number(),
    }),
    v.null(),
  ),
  handler: async (ctx, args) => {
    const claim = await ctx.db.get(args.claimId);
    if (!claim) {
      return null;
    }

    await requirePermission(ctx, claim.organizationId, "loans.read");

    const policy = await ctx.db.get(claim.policyId);

    let collections:
      | Array<{
          _id: Id<"collections">;
          title: string;
          accessionNumber: string;
        }>
      | undefined;
    if (claim.collectionIds && claim.collectionIds.length > 0) {
      const collectionDocs = await Promise.all(
        claim.collectionIds.map((id) => ctx.db.get(id)),
      );
      collections = collectionDocs.flatMap((collection) =>
        collection === null
          ? []
          : [
              {
                _id: collection._id,
                title: collection.title,
                accessionNumber: collection.accessionNumber,
              },
            ],
      );
    }

    const [exhibition, loan] = await Promise.all([
      claim.exhibitionId ? ctx.db.get(claim.exhibitionId) : null,
      claim.loanId ? ctx.db.get(claim.loanId) : null,
    ]);
    const exhibitionTitle = exhibition?.title;
    const loanNumber = loan?.loanNumber;

    const documentUrls = claim.documentIds
      ? await Promise.all(claim.documentIds.map((id) => ctx.storage.getUrl(id)))
      : undefined;

    const photoUrls = claim.photoIds
      ? await Promise.all(claim.photoIds.map((id) => ctx.storage.getUrl(id)))
      : undefined;

    return {
      _id: claim._id,
      organizationId: claim.organizationId,
      policyId: claim.policyId,
      policyNumber: policy?.policyNumber ?? "",
      carrier: policy?.carrier ?? "",
      claimNumber: claim.claimNumber,
      collectionIds: claim.collectionIds,
      collections,
      exhibitionId: claim.exhibitionId,
      exhibitionTitle,
      loanId: claim.loanId,
      loanNumber,
      incidentDate: claim.incidentDate,
      incidentLocation: claim.incidentLocation,
      incidentType: claim.incidentType,
      incidentDescription: claim.incidentDescription,
      claimedAmount: claim.claimedAmount,
      assessedAmount: claim.assessedAmount,
      settledAmount: claim.settledAmount,
      deductibleApplied: claim.deductibleApplied,
      status: claim.status,
      reportedDate: claim.reportedDate,
      submittedDate: claim.submittedDate,
      reviewStartDate: claim.reviewStartDate,
      decisionDate: claim.decisionDate,
      settlementDate: claim.settlementDate,
      adjusterName: claim.adjusterName,
      adjusterPhone: claim.adjusterPhone,
      adjusterEmail: claim.adjusterEmail,
      adjusterNotes: claim.adjusterNotes,
      documentIds: claim.documentIds,
      documentUrls,
      photoIds: claim.photoIds,
      photoUrls,
      denialReason: claim.denialReason,
      payoutMethod: claim.payoutMethod,
      payoutDate: claim.payoutDate,
      payoutReference: claim.payoutReference,
      internalNotes: claim.internalNotes,
      createdBy: claim.createdBy,
      createdAt: claim.createdAt,
    };
  },
});

export const getExpiringPolicies = insuranceReadQuery({
  args: {
    organizationId: v.id("organizations"),
    daysAhead: v.optional(v.number()),
  },
  returns: v.array(
    v.object({
      _id: v.id("insurancePolicies"),
      policyNumber: v.string(),
      carrier: v.string(),
      expirationDate: v.number(),
      daysUntilExpiry: v.number(),
      coverageCount: v.number(),
      totalCoveredValue: v.number(),
    }),
  ),
  handler: async (ctx, args) => {
    const days = args.daysAhead ?? 30;
    const now = Date.now();
    const futureDate = now + days * 24 * 60 * 60 * 1000;
    const msPerDay = 24 * 60 * 60 * 1000;

    const enrichedPolicies: Array<{
      _id: Id<"insurancePolicies">;
      policyNumber: string;
      carrier: string;
      expirationDate: number;
      daysUntilExpiry: number;
      coverageCount: number;
      totalCoveredValue: number;
    }> = [];

    const expiringQuery = ctx.db
      .query("insurancePolicies")
      .withIndex("by_organization_and_expirationDate", (q) =>
        q
          .eq("organizationId", ctx.organizationId)
          .gte("expirationDate", now)
          .lte("expirationDate", futureDate),
      );

    for await (const policy of expiringQuery) {
      if (policy.status !== "active") {
        continue;
      }

      let coverageCount = 0;
      let totalCoveredValue = 0;
      const coverages = ctx.db
        .query("insuranceCoverages")
        .withIndex("by_policy_and_status", (q) =>
          q.eq("policyId", policy._id).eq("status", "active"),
        );
      for await (const coverage of coverages) {
        coverageCount += 1;
        totalCoveredValue += coverage.coveredValue;
      }

      enrichedPolicies.push({
        _id: policy._id,
        policyNumber: policy.policyNumber,
        carrier: policy.carrier,
        expirationDate: policy.expirationDate,
        daysUntilExpiry: Math.ceil((policy.expirationDate - now) / msPerDay),
        coverageCount,
        totalCoveredValue,
      });
    }

    return enrichedPolicies.sort(
      (a, b) => a.daysUntilExpiry - b.daysUntilExpiry,
    );
  },
});

export const getUncoveredObjects = insuranceReadQuery({
  args: {
    organizationId: v.id("organizations"),
    paginationOpts: paginationOptsValidator,
  },
  returns: v.object({
    page: v.array(
      v.object({
        _id: v.id("collections"),
        title: v.string(),
        accessionNumber: v.string(),
        status: v.string(),
      }),
    ),
    isDone: v.boolean(),
    continueCursor: v.string(),
  }),
  handler: async (ctx, args) => {
    const coveredObjectIds = new Set<Id<"collections">>();
    const activeCoverages = ctx.db
      .query("insuranceCoverages")
      .withIndex("by_organization_and_status", (q) =>
        q.eq("organizationId", ctx.organizationId).eq("status", "active"),
      );
    for await (const coverage of activeCoverages) {
      if (coverage.collectionId) {
        coveredObjectIds.add(coverage.collectionId);
      }
    }

    const uncoveredObjects: Array<{
      _id: Id<"collections">;
      title: string;
      accessionNumber: string;
      status: string;
    }> = [];
    const activeCollections = ctx.db
      .query("collections")
      .withIndex("by_organization_and_status", (q) =>
        q.eq("organizationId", ctx.organizationId).eq("status", "active"),
      );
    for await (const obj of activeCollections) {
      if (!coveredObjectIds.has(obj._id)) {
        uncoveredObjects.push({
          _id: obj._id,
          title: obj.title,
          accessionNumber: obj.accessionNumber,
          status: obj.status,
        });
      }
    }

    const cursor = args.paginationOpts.cursor
      ? Number.parseInt(args.paginationOpts.cursor, 10)
      : 0;
    const startIndex = cursor;
    const endIndex = Math.min(
      startIndex + args.paginationOpts.numItems,
      uncoveredObjects.length,
    );
    const page = uncoveredObjects.slice(startIndex, endIndex);

    return {
      page,
      isDone: endIndex >= uncoveredObjects.length,
      continueCursor: endIndex.toString(),
    };
  },
});

export const getInsuranceStats = insuranceReadQuery({
  args: {
    organizationId: v.id("organizations"),
  },
  returns: v.object({
    totalPolicies: v.number(),
    activePolicies: v.number(),
    totalCoverageValue: v.number(),
    totalCoveredItems: v.number(),
    uncoveredItemsCount: v.number(),
    openClaimsCount: v.number(),
    totalClaimedAmount: v.number(),
    expiringIn30Days: v.number(),
  }),
  handler: async (ctx) => {
    return await computeInsuranceStats(ctx, ctx.organizationId);
  },
});

export const uploadPolicyDocument = mutation({
  args: {
    policyId: v.id("insurancePolicies"),
    storageId: v.id("_storage"),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Not authenticated");
    }

    const policy = await ctx.db.get(args.policyId);
    if (!policy) {
      throw new Error("Policy not found");
    }

    await requirePermission(
      ctx,
      policy.organizationId,
      "organization.manage_settings",
    );

    const documentIds = policy.documentIds ?? [];
    documentIds.push(args.storageId);

    await ctx.db.patch(args.policyId, {
      documentIds,
      lastModifiedBy: userId,
      lastModifiedAt: Date.now(),
    });

    return null;
  },
});

export const uploadClaimDocument = mutation({
  args: {
    claimId: v.id("insuranceClaims"),
    storageId: v.id("_storage"),
    documentType: v.union(v.literal("document"), v.literal("photo")),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Not authenticated");
    }

    const claim = await ctx.db.get(args.claimId);
    if (!claim) {
      throw new Error("Claim not found");
    }

    await requirePermission(
      ctx,
      claim.organizationId,
      "organization.manage_settings",
    );

    if (args.documentType === "document") {
      const documentIds = claim.documentIds ?? [];
      documentIds.push(args.storageId);
      await ctx.db.patch(args.claimId, {
        documentIds,
        lastModifiedBy: userId,
        lastModifiedAt: Date.now(),
      });
    } else {
      const photoIds = claim.photoIds ?? [];
      photoIds.push(args.storageId);
      await ctx.db.patch(args.claimId, {
        photoIds,
        lastModifiedBy: userId,
        lastModifiedAt: Date.now(),
      });
    }

    return null;
  },
});

export const checkExpiringPoliciesInternal = internalMutation({
  args: {},
  returns: v.null(),
  handler: async (ctx) => {
    const organizations = await ctx.db.query("organizations").collect();

    const now = Date.now();
    const alertThresholds = [7, 14, 30];

    await Promise.all(
      Array.from(organizations).map(async (org) => {
        const activePolicies = await ctx.db
          .query("insurancePolicies")
          .withIndex("by_organization_and_status", (q) =>
            q.eq("organizationId", org._id).eq("status", "active"),
          )
          .collect();

        await Promise.all(
          activePolicies.map(async (policy) => {
            const daysUntilExpiry = Math.ceil(
              (policy.expirationDate - now) / (24 * 60 * 60 * 1000),
            );

            if (
              daysUntilExpiry <= 0 ||
              !alertThresholds.includes(daysUntilExpiry)
            ) {
              return;
            }

            const coverages = await ctx.db
              .query("insuranceCoverages")
              .withIndex("by_policy_and_status", (q) =>
                q.eq("policyId", policy._id).eq("status", "active"),
              )
              .collect();

            const totalCoveredValue = coverages.reduce(
              (sum, coverage) => sum + coverage.coveredValue,
              0,
            );

            const coordinatorUserIds = await getUserIdsWithPermission(
              ctx,
              org._id,
              "organization.manage_settings",
            );

            await Promise.all(
              coordinatorUserIds.map((coordinatorUserId) =>
                ctx.runMutation(internal.audit.createNotificationInternal, {
                  organizationId: org._id,
                  userId: coordinatorUserId,
                  type: "insurance_expiry",
                  title: `Insurance Policy Expiring in ${daysUntilExpiry} Days`,
                  message: `Policy ${policy.policyNumber} (${policy.carrier}) covering ${coverages.length} items worth $${totalCoveredValue.toLocaleString()} expires in ${daysUntilExpiry} days.`,
                  relatedEntityType: "insurancePolicy",
                  relatedEntityId: policy._id,
                }),
              ),
            );
          }),
        );
      }),
    );

    return null;
  },
});

export const checkMissingCoverageInternal = internalMutation({
  args: {},
  returns: v.null(),
  handler: async (ctx) => {
    const organizations = await ctx.db.query("organizations").collect();

    await Promise.all(
      Array.from(organizations).map(async (org) => {
        const allActiveObjects = await ctx.db
          .query("collections")
          .withIndex("by_organization_and_status", (q) =>
            q.eq("organizationId", org._id).eq("status", "active"),
          )
          .collect();

        if (allActiveObjects.length === 0) return;

        const allCoverages = await ctx.db
          .query("insuranceCoverages")
          .withIndex("by_organization_and_status", (q) =>
            q.eq("organizationId", org._id).eq("status", "active"),
          )
          .collect();

        const coveredObjectIds = new Set<string>();
        for (const coverage of allCoverages) {
          if (coverage.collectionId) {
            coveredObjectIds.add(coverage.collectionId);
          }
        }

        const uncoveredCount = allActiveObjects.filter(
          (obj) => !coveredObjectIds.has(obj._id),
        ).length;

        const coveragePercentage = Math.round(
          (coveredObjectIds.size / allActiveObjects.length) * 100,
        );

        if (uncoveredCount > 0 && coveragePercentage < 90) {
          const coordinatorUserIds = await getUserIdsWithPermission(
            ctx,
            org._id,
            "organization.manage_settings",
          );

          await Promise.all(
            coordinatorUserIds.map((userId) =>
              ctx.runMutation(internal.audit.createNotificationInternal, {
                organizationId: org._id,
                userId,
                type: "missing_coverage",
                title: "Objects Missing Insurance Coverage",
                message: `${uncoveredCount} of ${allActiveObjects.length} objects (${100 - coveragePercentage}%) are not covered by any insurance policy.`,
                relatedEntityType: "organization",
                relatedEntityId: org._id,
              }),
            ),
          );
        }
      }),
    );

    return null;
  },
});

// ============================================================================
// Dispute Workflow
// ============================================================================

const disputeStatusValidator = v.union(
  v.literal("pending"),
  v.literal("in_review"),
  v.literal("resolved"),
  v.literal("escalated"),
);

/**
 * Open a dispute on a claim
 */
export const openDispute = mutation({
  args: {
    claimId: v.id("insuranceClaims"),
    reason: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Not authenticated");
    }

    const claim = await ctx.db.get(args.claimId);
    if (!claim) {
      throw new Error("Claim not found");
    }

    if (
      claim.status !== "denied" &&
      claim.status !== "approved" &&
      claim.status !== "settled"
    ) {
      throw new Error("Can only dispute claims that have been decided");
    }

    if (claim.isDisputed) {
      throw new Error("Claim already has an open dispute");
    }

    await requirePermission(
      ctx,
      claim.organizationId,
      "organization.manage_settings",
    );

    await Promise.all([
      ctx.db.patch(args.claimId, {
        status: "appealed",
        isDisputed: true,
        disputeReason: args.reason,
        disputeDate: Date.now(),
        disputeStatus: "pending",
        lastModifiedBy: userId,
        lastModifiedAt: Date.now(),
      }),
      ctx.runMutation(internal.audit.logAction, {
        organizationId: claim.organizationId,
        userId,
        action: "opened_dispute",
        entityType: "insuranceClaim",
        entityId: args.claimId,
        changes: { reason: args.reason },
      }),
    ] as const);

    return null;
  },
});

/**
 * Update dispute status
 */
export const updateDisputeStatus = mutation({
  args: {
    claimId: v.id("insuranceClaims"),
    disputeStatus: disputeStatusValidator,
    notes: v.optional(v.string()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Not authenticated");
    }

    const claim = await ctx.db.get(args.claimId);
    if (!claim) {
      throw new Error("Claim not found");
    }

    if (!claim.isDisputed) {
      throw new Error("Claim does not have an open dispute");
    }

    await requirePermission(
      ctx,
      claim.organizationId,
      "organization.manage_settings",
    );

    const updates: Record<string, unknown> = {
      disputeStatus: args.disputeStatus,
      lastModifiedBy: userId,
      lastModifiedAt: Date.now(),
    };

    if (args.notes) {
      updates.internalNotes = claim.internalNotes
        ? `${claim.internalNotes}\n\n[${new Date().toISOString()}] Dispute update: ${args.notes}`
        : `[${new Date().toISOString()}] Dispute update: ${args.notes}`;
    }

    await Promise.all([
      ctx.db.patch(args.claimId, updates),
      ctx.runMutation(internal.audit.logAction, {
      organizationId: claim.organizationId,
      userId,
      action: "updated_dispute",
      entityType: "insuranceClaim",
      entityId: args.claimId,
      changes: { disputeStatus: args.disputeStatus },
    }),
    ]);

    return null;
  },
});

/**
 * Resolve a dispute
 */
export const resolveDispute = mutation({
  args: {
    claimId: v.id("insuranceClaims"),
    resolution: v.string(),
    newStatus: v.optional(claimStatusValidator),
    settledAmount: v.optional(v.number()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Not authenticated");
    }

    const claim = await ctx.db.get(args.claimId);
    if (!claim) {
      throw new Error("Claim not found");
    }

    if (!claim.isDisputed) {
      throw new Error("Claim does not have an open dispute");
    }

    await requirePermission(
      ctx,
      claim.organizationId,
      "organization.manage_settings",
    );

    const now = Date.now();
    const updates: Record<string, unknown> = {
      disputeStatus: "resolved",
      disputeResolution: args.resolution,
      disputeResolvedDate: now,
      lastModifiedBy: userId,
      lastModifiedAt: now,
    };

    if (args.newStatus) {
      updates.status = args.newStatus;
      if (args.newStatus === "settled") {
        updates.settlementDate = now;
      }
    }

    if (args.settledAmount !== undefined) {
      updates.settledAmount = args.settledAmount;
    }

    await Promise.all([
      ctx.db.patch(args.claimId, updates),
      ctx.runMutation(internal.audit.logAction, {
      organizationId: claim.organizationId,
      userId,
      action: "resolved_dispute",
      entityType: "insuranceClaim",
      entityId: args.claimId,
      changes: {
        resolution: args.resolution,
        newStatus: args.newStatus,
        settledAmount: args.settledAmount,
      },
    }),
    ]);

    return null;
  },
});

/**
 * Upload dispute documents
 */
export const uploadDisputeDocument = mutation({
  args: {
    claimId: v.id("insuranceClaims"),
    storageId: v.id("_storage"),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Not authenticated");
    }

    const claim = await ctx.db.get(args.claimId);
    if (!claim) {
      throw new Error("Claim not found");
    }

    if (!claim.isDisputed) {
      throw new Error("Claim does not have an open dispute");
    }

    await requirePermission(
      ctx,
      claim.organizationId,
      "organization.manage_settings",
    );

    const documentIds = claim.disputeDocumentIds ?? [];
    documentIds.push(args.storageId);

    await ctx.db.patch(args.claimId, {
      disputeDocumentIds: documentIds,
      lastModifiedBy: userId,
      lastModifiedAt: Date.now(),
    });

    return null;
  },
});

// ============================================================================
// Auto-Claim on Transit Damage
// ============================================================================

/**
 * Create auto-claim draft for transit damage
 */
export const createAutoClaimForTransitDamage = internalMutation({
  args: {
    organizationId: v.id("organizations"),
    loanId: v.id("loans"),
    collectionIds: v.array(v.id("collections")),
    incidentDescription: v.string(),
    conditionDisputeId: v.optional(v.id("conditionDisputes")),
  },
  returns: v.union(v.id("insuranceClaims"), v.null()),
  handler: async (ctx, args) => {
    // Find active transit or loan policy
    const policies = await ctx.db
      .query("insurancePolicies")
      .withIndex("by_organization_and_status", (q) =>
        q.eq("organizationId", args.organizationId).eq("status", "active"),
      )
      .filter((q) =>
        q.or(
          q.eq(q.field("policyType"), "transit"),
          q.eq(q.field("policyType"), "loan"),
          q.eq(q.field("policyType"), "blanket"),
        ),
      )
      .collect();

    if (policies.length === 0) {
      return null;
    }

    // Use the first matching policy
    const policy = policies[0]!;

    // Calculate claimed amount from active coverages
    let claimedAmount = 0;
    await Promise.all(
      Array.from(args.collectionIds).map(async (collectionId) => {
        // Look up active coverage for this collection
        const coverage = await ctx.db
          .query("insuranceCoverages")
          .withIndex("by_collection", (q) => q.eq("collectionId", collectionId))
          .filter((q) => q.eq(q.field("status"), "active"))
          .first();
        if (coverage) {
          claimedAmount += coverage.coveredValue;
        }
      }),
    );

    const [claimNumber, createdByUser] = await Promise.all([
      generateNextClaimNumber(ctx, args.organizationId),
      ctx.db.query("users").first(),
    ] as const);
    const now = Date.now();

    const [claimId, coordinatorUserIds] = await Promise.all([
      ctx.db.insert("insuranceClaims", {
        organizationId: args.organizationId,
        policyId: policy._id,
        claimNumber,
        collectionIds: args.collectionIds,
        loanId: args.loanId,
        incidentDate: now,
        incidentType: "transit",
        incidentDescription: args.incidentDescription,
        claimedAmount,
        status: "draft",
        reportedDate: now,
        isAutoClaim: true,
        autoClaimSource: "loan_return_damage",
        conditionDisputeId: args.conditionDisputeId,
        internalNotes:
          "Auto-generated claim based on condition change detected during loan return.",
        createdBy: createdByUser?._id as Id<"users">,
        createdAt: now,
      }),
      getUserIdsWithPermission(
        ctx,
        args.organizationId,
        "organization.manage_settings",
      ),
    ]);

    await Promise.all(
      coordinatorUserIds.map((userId) =>
        ctx.runMutation(internal.audit.createNotificationInternal, {
          organizationId: args.organizationId,
          userId,
          type: "insurance_auto_claim",
          title: "Auto-Generated Insurance Claim",
          message: `A draft insurance claim (${claimNumber}) has been created for transit damage detected during loan return. Please review and submit.`,
          relatedEntityType: "insuranceClaim",
          relatedEntityId: claimId,
        }),
      ),
    );

    return claimId;
  },
});

// ============================================================================
// Appraisal Enforcement
// ============================================================================

/**
 * Link appraisal to coverage
 */
export const linkAppraisalToCoverage = mutation({
  args: {
    coverageId: v.id("insuranceCoverages"),
    appraisalId: v.id("appraisals"),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Not authenticated");
    }

    const coverage = await ctx.db.get(args.coverageId);
    if (!coverage) {
      throw new Error("Coverage not found");
    }

    await requirePermission(
      ctx,
      coverage.organizationId,
      "organization.manage_settings",
    );

    const appraisal = await ctx.db.get(args.appraisalId);
    if (!appraisal) {
      throw new Error("Appraisal not found");
    }

    // Update coverage with appraisal info
    await ctx.db.patch(args.coverageId, {
      appraisalId: args.appraisalId,
      appraisalDate: appraisal.appraisalDate,
      appraisalWarning: undefined, // Clear any warning
    });

    await ctx.runMutation(internal.audit.logAction, {
      organizationId: coverage.organizationId,
      userId,
      action: "linked_appraisal",
      entityType: "insuranceCoverage",
      entityId: args.coverageId,
      changes: { appraisalId: args.appraisalId },
    });

    return null;
  },
});

/**
 * Check appraisal status for coverage
 */
export const checkAppraisalForCoverage = query({
  args: {
    collectionId: v.id("collections"),
  },
  returns: v.object({
    hasAppraisal: v.boolean(),
    appraisalValid: v.boolean(),
    appraisalId: v.optional(v.id("appraisals")),
    appraisalDate: v.optional(v.number()),
    appraisalValue: v.optional(v.number()),
    appraisalAgeDays: v.optional(v.number()),
    warning: v.optional(v.string()),
  }),
  handler: async (ctx, args) => {
    const collection = await ctx.db.get(args.collectionId);
    if (!collection) {
      return {
        hasAppraisal: false,
        appraisalValid: false,
        warning: "Collection not found",
      };
    }

    // Find most recent appraisal
    const appraisals = await ctx.db
      .query("appraisals")
      .withIndex("by_collection", (q) =>
        q.eq("collectionId", args.collectionId),
      )
      .collect();

    if (appraisals.length === 0) {
      return {
        hasAppraisal: false,
        appraisalValid: false,
        warning: "No appraisal on file",
      };
    }

    // Sort by date and get most recent
    const sortedAppraisals = appraisals.sort(
      (a, b) => b.appraisalDate - a.appraisalDate,
    );
    const latestAppraisal = sortedAppraisals[0]!;

    const now = Date.now();
    const ageDays = Math.floor(
      (now - latestAppraisal.appraisalDate) / (24 * 60 * 60 * 1000),
    );
    const threeYearsInDays = 3 * 365;

    let warning: string | undefined;
    let appraisalValid = true;

    if (ageDays > threeYearsInDays) {
      warning = `Appraisal is ${Math.floor(ageDays / 365)} years old and may be stale`;
      appraisalValid = false;
    } else if (ageDays > 2 * 365) {
      warning = "Appraisal is over 2 years old and should be updated soon";
    }

    return {
      hasAppraisal: true,
      appraisalValid,
      appraisalId: latestAppraisal._id,
      appraisalDate: latestAppraisal.appraisalDate,
      appraisalValue: latestAppraisal.value,
      appraisalAgeDays: ageDays,
      warning,
    };
  },
});

/**
 * Get coverages with stale appraisals
 */
export const getCoveragesWithStaleAppraisals = insuranceReadQuery({
  args: {
    organizationId: v.id("organizations"),
    appraisalMaxAgeDays: v.optional(v.number()),
  },
  returns: v.array(
    v.object({
      _id: v.id("insuranceCoverages"),
      policyId: v.id("insurancePolicies"),
      policyNumber: v.string(),
      collectionId: v.optional(v.id("collections")),
      collectionTitle: v.optional(v.string()),
      coveredValue: v.number(),
      appraisalId: v.optional(v.id("appraisals")),
      appraisalDate: v.optional(v.number()),
      appraisalAgeDays: v.optional(v.number()),
      issue: v.string(),
    }),
  ),
  handler: async (ctx, args) => {
    const maxAgeDays = args.appraisalMaxAgeDays ?? 3 * 365; // Default 3 years
    const now = Date.now();
    const msPerDay = 24 * 60 * 60 * 1000;

    const results: Array<{
      _id: Id<"insuranceCoverages">;
      policyId: Id<"insurancePolicies">;
      policyNumber: string;
      collectionId?: Id<"collections">;
      collectionTitle?: string;
      coveredValue: number;
      appraisalId?: Id<"appraisals">;
      appraisalDate?: number;
      appraisalAgeDays?: number;
      issue: string;
    }> = [];

    const activeCoverages = ctx.db
      .query("insuranceCoverages")
      .withIndex("by_organization_and_status", (q) =>
        q.eq("organizationId", ctx.organizationId).eq("status", "active"),
      );

    for await (const coverage of activeCoverages) {
        if (!coverage.collectionId) continue;

      const [policy, collection] = await Promise.all([
        ctx.db.get(coverage.policyId),
        ctx.db.get(coverage.collectionId),
      ] as const);

      // Check for linked appraisal
      if (coverage.appraisalId) {
        const appraisal = await ctx.db.get(coverage.appraisalId);
        if (appraisal) {
          const ageDays = Math.floor(
            (now - appraisal.appraisalDate) / msPerDay,
          );
          if (ageDays > maxAgeDays) {
            results.push({
              _id: coverage._id,
              policyId: coverage.policyId,
              policyNumber: policy?.policyNumber ?? "Unknown",
              collectionId: coverage.collectionId,
              collectionTitle: collection?.title,
              coveredValue: coverage.coveredValue,
              appraisalId: coverage.appraisalId,
              appraisalDate: appraisal.appraisalDate,
              appraisalAgeDays: ageDays,
              issue: `Appraisal is ${Math.floor(ageDays / 365)} years old`,
            });
          }
        }
        continue;
      }

      // No linked appraisal - check if collection has one
      let latestAppraisalDate: number | undefined;
      const appraisals = ctx.db
        .query("appraisals")
        .withIndex("by_collection", (q) =>
          q.eq("collectionId", coverage.collectionId),
        );
      for await (const appraisal of appraisals) {
        if (
          latestAppraisalDate === undefined ||
          appraisal.appraisalDate > latestAppraisalDate
        ) {
          latestAppraisalDate = appraisal.appraisalDate;
        }
      }

      if (latestAppraisalDate === undefined) {
        results.push({
          _id: coverage._id,
          policyId: coverage.policyId,
          policyNumber: policy?.policyNumber ?? "Unknown",
          collectionId: coverage.collectionId,
          collectionTitle: collection?.title,
          coveredValue: coverage.coveredValue,
          issue: "No appraisal on file",
        });
        continue;
      }

      const ageDays = Math.floor((now - latestAppraisalDate) / msPerDay);
      if (ageDays > maxAgeDays) {
        results.push({
          _id: coverage._id,
          policyId: coverage.policyId,
          policyNumber: policy?.policyNumber ?? "Unknown",
          collectionId: coverage.collectionId,
          collectionTitle: collection?.title,
          coveredValue: coverage.coveredValue,
          appraisalDate: latestAppraisalDate,
          appraisalAgeDays: ageDays,
          issue: `Appraisal is ${Math.floor(ageDays / 365)} years old (not linked)`,
        });
      }
    }

    return results;
  },
});

/**
 * Add coverage with appraisal verification
 */
export const addCoverageWithAppraisalCheck = mutation({
  args: {
    policyId: v.id("insurancePolicies"),
    collectionId: v.id("collections"),
    coveredValue: v.number(),
    requireAppraisal: v.optional(v.boolean()),
    skipAppraisalWarning: v.optional(v.boolean()),
    notes: v.optional(v.string()),
  },
  returns: v.object({
    coverageId: v.optional(v.id("insuranceCoverages")),
    warning: v.optional(v.string()),
    blocked: v.boolean(),
  }),
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Not authenticated");
    }

    const policy = await ctx.db.get(args.policyId);
    if (!policy) {
      throw new Error("Policy not found");
    }

    await requirePermission(
      ctx,
      policy.organizationId,
      "organization.manage_settings",
    );

    const collection = await ctx.db.get(args.collectionId);
    if (!collection || collection.organizationId !== policy.organizationId) {
      throw new Error("Collection not found or belongs to different org");
    }

    // Check appraisal status
    const appraisals = await ctx.db
      .query("appraisals")
      .withIndex("by_collection", (q) =>
        q.eq("collectionId", args.collectionId),
      )
      .collect();

    let warning: string | undefined;
    let appraisalId: Id<"appraisals"> | undefined;
    let appraisalDate: number | undefined;

    if (appraisals.length === 0) {
      if (args.requireAppraisal && !args.skipAppraisalWarning) {
        return {
          blocked: true,
          warning: "Appraisal required before adding insurance coverage",
        };
      }
      warning = "No appraisal on file for this object";
    } else {
      const latest = appraisals.sort(
        (a, b) => b.appraisalDate - a.appraisalDate,
      )[0]!;
      appraisalId = latest._id;
      appraisalDate = latest.appraisalDate;

      const now = Date.now();
      const ageDays = Math.floor(
        (now - latest.appraisalDate) / (24 * 60 * 60 * 1000),
      );
      const threeYearsInDays = 3 * 365;

      if (ageDays > threeYearsInDays) {
        if (args.requireAppraisal && !args.skipAppraisalWarning) {
          return {
            blocked: true,
            warning: `Appraisal is ${Math.floor(ageDays / 365)} years old. Updated appraisal required.`,
          };
        }
        warning = `Appraisal is ${Math.floor(ageDays / 365)} years old`;
      }
    }

    const coverageId = await ctx.db.insert("insuranceCoverages", {
      organizationId: policy.organizationId,
      policyId: args.policyId,
      collectionId: args.collectionId,
      coveredValue: args.coveredValue,
      status: "active",
      appraisalId,
      appraisalDate,
      appraisalRequired: args.requireAppraisal,
      appraisalWarning: warning,
      notes: args.notes,
      createdBy: userId,
      createdAt: Date.now(),
    });

    await ctx.runMutation(internal.audit.logAction, {
      organizationId: policy.organizationId,
      userId,
      action: "created",
      entityType: "insuranceCoverage",
      entityId: coverageId,
      changes: {
        policyId: args.policyId,
        coveredValue: args.coveredValue,
        appraisalWarning: warning,
      },
    });

    return { coverageId, warning, blocked: false };
  },
});

export const getCoverageAlerts = insuranceReadQuery({
  args: {
    organizationId: v.id("organizations"),
  },
  returns: v.object({
    expiringPolicies: v.array(
      v.object({
        _id: v.id("insurancePolicies"),
        policyNumber: v.string(),
        carrier: v.string(),
        expirationDate: v.number(),
        daysUntilExpiry: v.number(),
        coverageCount: v.number(),
        totalCoveredValue: v.number(),
        severity: v.union(
          v.literal("critical"),
          v.literal("warning"),
          v.literal("info"),
        ),
      }),
    ),
    uncoveredStats: v.object({
      totalObjects: v.number(),
      coveredObjects: v.number(),
      uncoveredObjects: v.number(),
      coveragePercentage: v.number(),
    }),
    expiredPoliciesCount: v.number(),
    pendingClaimsCount: v.number(),
    staleAppraisalCount: v.number(),
    disputedClaimsCount: v.number(),
  }),
  handler: async (ctx) => {
    return await computeCoverageAlerts(ctx, ctx.organizationId);
  },
});
