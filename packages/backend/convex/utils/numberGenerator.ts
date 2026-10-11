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

import type { GenericMutationCtx, GenericQueryCtx } from "convex/server";
import type { DataModel, Id } from "../_generated/dataModel";

type _QueryCtx = GenericQueryCtx<DataModel>;
type MutationCtx = GenericMutationCtx<DataModel>;

/**
 * Scope types for counter organization
 * - "global": Single counter per organization (no year scoping)
 * - "year": Counter resets each year
 */
export type CounterScope = "global" | "year";

/**
 * Year-based counter record (for loans, transit, claims, deaccessions)
 *
 * Represents a counter that resets annually. Each organization can have
 * multiple counters, one per year.
 *
 * @property _id - Unique identifier for this counter
 * @property _creationTime - Timestamp when counter was created
 * @property organizationId - Organization this counter belongs to
 * @property year - Year this counter is scoped to (e.g., 2024)
 * @property currentValue - Current counter value (increments atomically)
 * @property lastGeneratedAt - Timestamp of last counter increment
 */
export interface YearBasedCounter {
  _id:
    | Id<"claimCounters">
    | Id<"deaccessionCounters">
    | Id<"loanCounters">
    | Id<"objectEntryCounters">
    | Id<"transitCounters">
    | Id<"incidentCounters">;
  _creationTime: number;
  organizationId: Id<"organizations">;
  year: number;
  currentValue: number;
  lastGeneratedAt: number;
}

/**
 * Global counter record (for accounts)
 *
 * Represents a counter that never resets. Each organization has a single
 * global counter per entity type.
 *
 * @property _id - Unique identifier for this counter
 * @property _creationTime - Timestamp when counter was created
 * @property organizationId - Organization this counter belongs to
 * @property currentValue - Current counter value (increments atomically)
 * @property lastGeneratedAt - Timestamp of last counter increment
 */
export interface GlobalCounter {
  _id: Id<"accountCounters">;
  _creationTime: number;
  organizationId: Id<"organizations">;
  currentValue: number;
  lastGeneratedAt: number;
}

/**
 * Get and increment the next counter value for year-based counters
 *
 * This function handles atomic incrementation for counters that reset annually.
 * If a counter doesn't exist for the given year, it creates one starting at 1.
 * If it exists, it increments the current value.
 *
 * @param ctx - Mutation context for database operations
 * @param existingCounter - The counter record from database query (null if doesn't exist)
 * @param params - Configuration object
 * @param params.tableName - Name of the counter table to use
 * @param params.organizationId - Organization ID for the counter
 * @param params.year - Year for counter scoping (e.g., 2024)
 * @returns Promise resolving to the next counter value
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
 *   year: 2024,
 * });
 * // Returns: 1 (if new), or currentValue + 1 (if exists)
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
      | "deaccessionCounters"
      | "objectEntryCounters"
      | "incidentCounters";
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
  }

  // Create new counter starting at 1
  await ctx.db.insert(tableName, {
    organizationId,
    year,
    currentValue: 1,
    lastGeneratedAt: Date.now(),
  });

  return 1;
}

/**
 * Get and increment the next counter value for global counters
 *
 * This function handles atomic incrementation for counters that never reset.
 * If a counter doesn't exist, it creates one starting at 1.
 * If it exists, it increments the current value.
 *
 * @param ctx - Mutation context for database operations
 * @param existingCounter - The counter record from database query (null if doesn't exist)
 * @param params - Configuration object
 * @param params.tableName - Name of the counter table to use
 * @param params.organizationId - Organization ID for the counter
 * @returns Promise resolving to the next counter value
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
 * // Returns: 1 (if new), or currentValue + 1 (if exists)
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
  }

  // Create new counter starting at 1
  await ctx.db.insert(tableName, {
    organizationId,
    currentValue: 1,
    lastGeneratedAt: Date.now(),
  });

  return 1;
}

/**
 * Get the current year for year-based counters
 *
 * Utility function that returns the current year from the system clock.
 * Used by year-based counter implementations to determine the appropriate
 * year scope for counter queries.
 *
 * @returns The current year as a 4-digit number (e.g., 2024)
 *
 * @example
 * const year = getCurrentYear(); // 2024
 * const counter = await ctx.db
 *   .query("loanCounters")
 *   .withIndex("by_organization_and_year", (q) =>
 *     q.eq("organizationId", orgId).eq("year", year)
 *   )
 *   .first();
 */
export function getCurrentYear(): number {
  return new Date().getFullYear();
}

/**
 * Format number with leading zeros
 *
 * Pads a number with leading zeros to reach the specified length.
 * Used for generating formatted ID strings like "0042" or "000123".
 *
 * @param value - The number to format
 * @param length - The desired total length of the output string
 * @returns String representation of the number with leading zeros
 *
 * @example
 * padNumber(42, 4)   // "0042"
 * padNumber(123, 3)  // "123"
 * padNumber(7, 6)    // "000007"
 * padNumber(9999, 4) // "9999"
 *
 * @example
 * // Common usage in number generation:
 * const year = 2024;
 * const counter = 42;
 * const loanId = `L${year}-${padNumber(counter, 4)}`; // "L2024-0042"
 */
export function padNumber(value: number, length: number): string {
  return String(value).padStart(length, "0");
}

export async function generateNextOrganizationAccountNumber(
  ctx: MutationCtx,
): Promise<string> {
  const counter = await ctx.db
    .query("organizationRegistryCounter")
    .withIndex("by_scopeKey", (q) => q.eq("scopeKey", "global"))
    .first();

  let nextValue: number;
  if (counter) {
    nextValue = counter.currentValue + 1;
    await ctx.db.patch(counter._id, {
      currentValue: nextValue,
      lastGeneratedAt: Date.now(),
    });
  } else {
    nextValue = 1;
    await ctx.db.insert("organizationRegistryCounter", {
      scopeKey: "global",
      currentValue: nextValue,
      lastGeneratedAt: Date.now(),
    });
  }

  return `ORG-${padNumber(nextValue, 5)}`;
}

export async function generateNextAccountNumber(
  ctx: MutationCtx,
  organizationId: Id<"organizations">,
): Promise<string> {
  const counter = await ctx.db
    .query("accountCounters")
    .withIndex("by_organization", (q) => q.eq("organizationId", organizationId))
    .first();

  const nextValue = await getNextGlobalValue(ctx, counter, {
    tableName: "accountCounters",
    organizationId,
  });

  return `ACC-${padNumber(nextValue, 5)}`;
}

export async function generateNextLoanNumber(
  ctx: MutationCtx,
  organizationId: Id<"organizations">,
): Promise<string> {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const counter = await ctx.db
    .query("loanCounters")
    .withIndex("by_organization_and_year", (q) =>
      q.eq("organizationId", organizationId).eq("year", year),
    )
    .first();

  const nextValue = await getNextYearBasedValue(ctx, counter, {
    tableName: "loanCounters",
    organizationId,
    year,
  });

  return `L${year}.${month}.${padNumber(nextValue, 4)}`;
}

export async function generateNextDeaccessionNumber(
  ctx: MutationCtx,
  organizationId: Id<"organizations">,
): Promise<string> {
  const org = await ctx.db.get(organizationId);
  if (!org) {
    throw new Error("Organization not found");
  }

  const year = getCurrentYear();
  const orgSlug = org.slug.toUpperCase().substring(0, 3);
  const counter = await ctx.db
    .query("deaccessionCounters")
    .withIndex("by_organization_and_year", (q) =>
      q.eq("organizationId", organizationId).eq("year", year),
    )
    .first();

  const nextValue = await getNextYearBasedValue(ctx, counter, {
    tableName: "deaccessionCounters",
    organizationId,
    year,
  });

  return `DA-${orgSlug}-${year}-${padNumber(nextValue, 3)}`;
}

export async function generateNextTransitNumber(
  ctx: MutationCtx,
  organizationId: Id<"organizations">,
): Promise<string> {
  const year = getCurrentYear();
  const counter = await ctx.db
    .query("transitCounters")
    .withIndex("by_organization_and_year", (q) =>
      q.eq("organizationId", organizationId).eq("year", year),
    )
    .first();

  const nextValue = await getNextYearBasedValue(ctx, counter, {
    tableName: "transitCounters",
    organizationId,
    year,
  });

  return `TRN-${year}-${padNumber(nextValue, 4)}`;
}

export async function generateNextClaimNumber(
  ctx: MutationCtx,
  organizationId: Id<"organizations">,
): Promise<string> {
  const year = getCurrentYear();
  const counter = await ctx.db
    .query("claimCounters")
    .withIndex("by_organization_and_year", (q) =>
      q.eq("organizationId", organizationId).eq("year", year),
    )
    .first();

  const nextValue = await getNextYearBasedValue(ctx, counter, {
    tableName: "claimCounters",
    organizationId,
    year,
  });

  return `CLM-${year}-${padNumber(nextValue, 4)}`;
}

/** Incident numbers: INC-{year}-{0001}, per organization and year. */
export async function generateNextIncidentNumber(
  ctx: MutationCtx,
  organizationId: Id<"organizations">,
): Promise<string> {
  const year = getCurrentYear();
  const counter = await ctx.db
    .query("incidentCounters")
    .withIndex("by_organization_and_year", (q) =>
      q.eq("organizationId", organizationId).eq("year", year),
    )
    .first();
  const nextValue = await getNextYearBasedValue(ctx, counter, {
    tableName: "incidentCounters",
    organizationId,
    year,
  });
  return `INC-${year}-${padNumber(nextValue, 4)}`;
}
