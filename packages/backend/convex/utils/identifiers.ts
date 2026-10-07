import { ConvexError } from "convex/values";
import type { Doc, Id } from "../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../_generated/server";
import { getNextCounterValue } from "./accessionCounter";
import { accessionParser } from "./accessionNumberParser";

export type IdentifierRegister = "catalog" | "accession";

// Search keys never replace the permanent, verbatim identifier.
export function normalizeIdentifier(value: string): string {
  return value.normalize("NFC").trim().toLowerCase();
}

export async function findIdentifierMatches(
  ctx: QueryCtx,
  organizationId: Id<"organizations">,
  register: IdentifierRegister,
  value: string,
) {
  const table = register === "catalog" ? "collections" : "accessions";
  const key = normalizeIdentifier(value);
  const indexed = await ctx.db
    .query(table)
    .withIndex("by_organization_and_normalizedIdentifier", (q) =>
      q.eq("organizationId", organizationId).eq("normalizedIdentifier", key),
    )
    .take(101);
  // During additive backfill, inspect a bounded legacy tail. Fail closed when
  // more than a single batch remains; never certify an incomplete scan.
  const legacy = await ctx.db
    .query(table)
    .withIndex("by_organization_and_normalizedIdentifier", (q) =>
      q
        .eq("organizationId", organizationId)
        .eq("normalizedIdentifier", undefined),
    )
    .take(101);
  return {
    matches: [
      ...indexed,
      ...legacy.filter(
        (row) => normalizeIdentifier(row.accessionNumber) === key,
      ),
    ],
    needsBackfill: legacy.length > 100,
    truncated: indexed.length > 100,
  };
}

export async function ensureIdentifierAvailable(
  ctx: MutationCtx,
  organizationId: Id<"organizations">,
  register: IdentifierRegister,
  value: string,
  existingId?: Id<"collections"> | Id<"accessions">,
) {
  const key = normalizeIdentifier(value);
  if (
    !key ||
    key.length > 256 ||
    [...value].some(
      (character) =>
        character.charCodeAt(0) < 32 || character.charCodeAt(0) === 127,
    )
  ) {
    throw new ConvexError(
      "Identifier must contain 1–256 visible characters. Existing historical identifiers remain unchanged.",
    );
  }
  const { matches, needsBackfill } = await findIdentifierMatches(
    ctx,
    organizationId,
    register,
    value,
  );
  if (matches.some((row) => row._id !== existingId)) {
    throw new ConvexError(
      `Identifier '${value}' already exists in the ${register} register. Open the existing record or choose an unused identifier. Historical records must not be renumbered or merged to resolve this conflict.`,
    );
  }
  if (needsBackfill) {
    throw new ConvexError(
      `Identifier review required: complete the ${register} identifier index in Settings > Preferences before assigning new numbers.`,
    );
  }
  return key;
}

export async function generateConfiguredIdentifier(
  ctx: MutationCtx,
  organizationId: Id<"organizations">,
  register: IdentifierRegister,
): Promise<string> {
  const organization = await ctx.db.get(organizationId);
  const template = organization?.settings?.accessionNumberFormat;
  if (!organization?.settings?.autoGenerateAccessionNumbers || !template) {
    throw new ConvexError(
      "Number generation is not configured. Supply an identifier or configure the institution's numbering format in Settings > Preferences.",
    );
  }
  const now = new Date();
  const scope =
    organization.settings.accessionCounterScope ??
    accessionParser.getCounterScopeFromTemplate(template);
  const scopeKey = accessionParser.getScopeKey(scope, now);
  for (let attempt = 0; attempt < 25; attempt++) {
    const counterValue = await getNextCounterValue(
      ctx,
      organizationId,
      scope,
      scopeKey,
    );
    const value = accessionParser.parse(template, {
      organizationSlug: organization.slug,
      currentDate: now,
      counterValue,
      counterScope: scope,
    });
    const { matches, needsBackfill } = await findIdentifierMatches(
      ctx,
      organizationId,
      register,
      value,
    );
    if (needsBackfill)
      await ensureIdentifierAvailable(ctx, organizationId, register, value);
    if (matches.length === 0) {
      await ensureIdentifierAvailable(ctx, organizationId, register, value);
      return value;
    }
  }
  throw new ConvexError(
    `Configured numbering format produced 25 occupied ${register} identifiers. Review the format or counter in Settings > Preferences.`,
  );
}

/**
 * Identifier prefix search within one register. Indexed identifiers use a true
 * prefix boundary. Unindexed historical rows are checked in one bounded batch;
 * `incomplete` reports when more remain, so callers can disclose it.
 */
interface IdentifierPrefixResult<Row> {
  rows: Row[];
  incomplete: boolean;
}

export async function searchIdentifierPrefix(
  ctx: QueryCtx,
  organizationId: Id<"organizations">,
  register: "catalog",
  value: string,
  limit: number,
): Promise<IdentifierPrefixResult<Doc<"collections">>>;
export async function searchIdentifierPrefix(
  ctx: QueryCtx,
  organizationId: Id<"organizations">,
  register: "accession",
  value: string,
  limit: number,
): Promise<IdentifierPrefixResult<Doc<"accessions">>>;
export async function searchIdentifierPrefix(
  ctx: QueryCtx,
  organizationId: Id<"organizations">,
  register: IdentifierRegister,
  value: string,
  limit: number,
): Promise<IdentifierPrefixResult<Doc<"collections"> | Doc<"accessions">>> {
  const key = normalizeIdentifier(value);
  if (!key) return { rows: [], incomplete: false };
  const table = register === "catalog" ? "collections" : "accessions";
  const [indexed, legacy] = await Promise.all([
    ctx.db
      .query(table)
      .withIndex("by_organization_and_normalizedIdentifier", (q) =>
        q
          .eq("organizationId", organizationId)
          .gte("normalizedIdentifier", key)
          .lt("normalizedIdentifier", `${key}\uffff`),
      )
      .take(limit),
    ctx.db
      .query(table)
      .withIndex("by_organization_and_normalizedIdentifier", (q) =>
        q
          .eq("organizationId", organizationId)
          .eq("normalizedIdentifier", undefined),
      )
      .take(101),
  ] as const);
  return {
    rows: [
      ...indexed,
      ...legacy
        .slice(0, 100)
        .filter((row) =>
          normalizeIdentifier(row.accessionNumber).startsWith(key),
        ),
    ].slice(0, limit),
    incomplete: legacy.length > 100,
  };
}

export async function searchCatalogIdentifierPrefixByStatus(
  ctx: QueryCtx,
  organizationId: Id<"organizations">,
  status: Doc<"collections">["status"],
  value: string,
  limit: number,
): Promise<IdentifierPrefixResult<Doc<"collections">>> {
  const key = normalizeIdentifier(value);
  if (!key) return { rows: [], incomplete: false };
  const [indexed, legacy] = await Promise.all([
    ctx.db
      .query("collections")
      .withIndex("by_organization_and_status_and_normalizedIdentifier", (q) =>
        q
          .eq("organizationId", organizationId)
          .eq("status", status)
          .gte("normalizedIdentifier", key)
          .lt("normalizedIdentifier", `${key}\uffff`),
      )
      .take(limit),
    ctx.db
      .query("collections")
      .withIndex("by_organization_and_status_and_normalizedIdentifier", (q) =>
        q
          .eq("organizationId", organizationId)
          .eq("status", status)
          .eq("normalizedIdentifier", undefined),
      )
      .take(101),
  ]);
  return {
    rows: [
      ...indexed,
      ...legacy
        .slice(0, 100)
        .filter((row) =>
          normalizeIdentifier(row.accessionNumber).startsWith(key),
        ),
    ].slice(0, limit),
    incomplete: legacy.length > 100,
  };
}
