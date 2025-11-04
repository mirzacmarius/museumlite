/**
 * Accession Number Counter Management
 *
 * Handles atomic counter incrementation with scope support
 */

import type { GenericQueryCtx, GenericMutationCtx } from "convex/server";
import type { DataModel } from "../_generated/dataModel";
import type { Id } from "../_generated/dataModel";

type QueryCtx = GenericQueryCtx<DataModel>;
type MutationCtx = GenericMutationCtx<DataModel>;

export type CounterScope = "global" | "year" | "month" | "day";

/**
 * Get and increment the next counter value for an organization
 * This function handles atomic incrementation with scope-based resets
 */
export async function getNextCounterValue(
  ctx: MutationCtx,
  organizationId: Id<"organizations">,
  scope: CounterScope,
  scopeKey: string,
): Promise<number> {
  // Try to find existing counter
  const existingCounter = await ctx.db
    .query("accessionCounters")
    .withIndex("by_organization_and_scope", (q) =>
      q
        .eq("organizationId", organizationId)
        .eq("scope", scope)
        .eq("scopeKey", scopeKey),
    )
    .unique();

  if (existingCounter) {
    // Increment existing counter
    const nextValue = existingCounter.currentValue + 1;

    await ctx.db.patch(existingCounter._id, {
      currentValue: nextValue,
      lastGeneratedAt: Date.now(),
    });

    return nextValue;
  } else {
    // Create new counter starting at 1
    await ctx.db.insert("accessionCounters", {
      organizationId,
      scope,
      scopeKey,
      currentValue: 1,
      lastGeneratedAt: Date.now(),
    });

    return 1;
  }
}

/**
 * Get the current counter value without incrementing
 */
export async function getCurrentCounterValue(
  ctx: QueryCtx,
  organizationId: Id<"organizations">,
  scope: CounterScope,
  scopeKey: string,
): Promise<number> {
  const counter = await ctx.db
    .query("accessionCounters")
    .withIndex("by_organization_and_scope", (q) =>
      q
        .eq("organizationId", organizationId)
        .eq("scope", scope)
        .eq("scopeKey", scopeKey),
    )
    .unique();

  return counter ? counter.currentValue : 0;
}

/**
 * Get the next counter value without incrementing (for preview)
 */
export async function getNextCounterPreview(
  ctx: QueryCtx,
  organizationId: Id<"organizations">,
  scope: CounterScope,
  scopeKey: string,
): Promise<number> {
  const current = await getCurrentCounterValue(
    ctx,
    organizationId,
    scope,
    scopeKey,
  );
  return current + 1;
}

/**
 * Reset counter for a specific scope (admin function)
 */
export async function resetCounter(
  ctx: MutationCtx,
  organizationId: Id<"organizations">,
  scope: CounterScope,
  scopeKey: string,
  newValue: number = 0,
): Promise<void> {
  const counter = await ctx.db
    .query("accessionCounters")
    .withIndex("by_organization_and_scope", (q) =>
      q
        .eq("organizationId", organizationId)
        .eq("scope", scope)
        .eq("scopeKey", scopeKey),
    )
    .unique();

  if (counter) {
    await ctx.db.patch(counter._id, {
      currentValue: newValue,
      lastGeneratedAt: Date.now(),
    });
  } else {
    await ctx.db.insert("accessionCounters", {
      organizationId,
      scope,
      scopeKey,
      currentValue: newValue,
      lastGeneratedAt: Date.now(),
    });
  }
}

/**
 * Get all counters for an organization (for admin/debugging)
 */
export async function getOrganizationCounters(
  ctx: QueryCtx,
  organizationId: Id<"organizations">,
) {
  return await ctx.db
    .query("accessionCounters")
    .withIndex("by_organization_and_scope")
    .filter((q) => q.eq(q.field("organizationId"), organizationId))
    .collect();
}
