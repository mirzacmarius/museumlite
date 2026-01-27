/**
 * Generic Number Generator Utility
 *
 * Provides atomic counter incrementation for various counter tables
 * Supports both year-based and global counters with flexible scoping
 *
 * This module provides shared logic for counter management without using
 * dynamic table names (which Convex's type system doesn't support).
 * Each consuming module should create wrapper functions that call these
 * helpers with their specific counter logic.
 */

import type { GenericQueryCtx, GenericMutationCtx } from "convex/server";
import type { DataModel } from "../_generated/dataModel";
import type { Id } from "../_generated/dataModel";

type QueryCtx = GenericQueryCtx<DataModel>;
type MutationCtx = GenericMutationCtx<DataModel>;

/**
 * Scope types for counter organization
 * - "global": Single counter per organization (no year scoping)
 * - "year": Counter resets each year
 */
export type CounterScope = "global" | "year";

/**
 * Year-based counter record (for loans, transit, claims, deaccessions)
 */
export interface YearBasedCounter {
  _id: Id<any>;
  _creationTime: number;
  organizationId: Id<"organizations">;
  year: number;
  currentValue: number;
  lastGeneratedAt: number;
}

/**
 * Global counter record (for accounts)
 */
export interface GlobalCounter {
  _id: Id<any>;
  _creationTime: number;
  organizationId: Id<"organizations">;
  currentValue: number;
  lastGeneratedAt: number;
}

/**
 * Helper for year-based counters (loans, transit, claims, deaccessions)
 *
 * @example
 * // In loans.ts:
 * const counter = await ctx.db
 *   .query("loanCounters")
 *   .withIndex("by_organization_and_year", (q) =>
 *     q.eq("organizationId", organizationId).eq("year", year)
 *   )
 *   .first();
 * const nextValue = await getNextYearBasedValue(ctx, counter, {
 *   tableName: "loanCounters",
 *   organizationId,
 *   year,
 * });
 */
export async function getNextYearBasedValue<
  T extends YearBasedCounter | null | undefined,
>(
  ctx: MutationCtx,
  existingCounter: T,
  params: {
    tableName:
      | "loanCounters"
      | "transitCounters"
      | "claimCounters"
      | "deaccessionCounters";
    organizationId: Id<"organizations">;
    year: number;
  },
): Promise<number> {
  const { tableName, organizationId, year } = params;

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
    await ctx.db.insert(tableName, {
      organizationId,
      year,
      currentValue: 1,
      lastGeneratedAt: Date.now(),
    });

    return 1;
  }
}

/**
 * Helper for global counters (accounts)
 *
 * @example
 * // In accounts.ts:
 * const counter = await ctx.db
 *   .query("accountCounters")
 *   .withIndex("by_organization", (q) => q.eq("organizationId", organizationId))
 *   .first();
 * const nextValue = await getNextGlobalValue(ctx, counter, {
 *   tableName: "accountCounters",
 *   organizationId,
 * });
 */
export async function getNextGlobalValue<
  T extends GlobalCounter | null | undefined,
>(
  ctx: MutationCtx,
  existingCounter: T,
  params: {
    tableName: "accountCounters";
    organizationId: Id<"organizations">;
  },
): Promise<number> {
  const { tableName, organizationId } = params;

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
    await ctx.db.insert(tableName, {
      organizationId,
      currentValue: 1,
      lastGeneratedAt: Date.now(),
    });

    return 1;
  }
}

/**
 * Utility to get the current year for year-based counters
 */
export function getCurrentYear(): number {
  return new Date().getFullYear();
}

/**
 * Format number with leading zeros
 *
 * @example
 * padNumber(42, 4) // "0042"
 * padNumber(123, 3) // "123"
 */
export function padNumber(value: number, length: number): string {
  return String(value).padStart(length, "0");
}
