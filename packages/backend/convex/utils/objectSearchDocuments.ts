import type { WithoutSystemFields } from "convex/server";
import type { Doc, Id } from "../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../_generated/server";
import {
  OBJECT_SEARCH_FIELDS,
  type ObjectSearchField,
} from "./catalogFilterValidators";

export { OBJECT_SEARCH_FIELDS, type ObjectSearchField };

/**
 * Bump when the document's composition changes; the backfill then rewrites
 * every Organization's documents before its search reads them again.
 */
export const OBJECT_SEARCH_DOCUMENT_VERSION = 2;

/** Characters of the description a document indexes. */
const DESCRIPTION_TEXT_LIMIT = 4000;
/** Characters of every other field, so one record cannot bloat its document. */
const FIELD_TEXT_LIMIT = 1000;
/** Image rows read to tell whether an Object has a photograph. */
const IMAGE_ROWS_CHECKED = 5;

type Ctx = Pick<QueryCtx, "db">;

/** A facet value as filtered: trimmed and case-folded. */
export function foldFacetValue(value: string | undefined | null) {
  const folded = value?.trim().toLowerCase();
  return folded ? folded : undefined;
}

/** Object types and materials are stored as text or as a JSON list of texts. */
export function storedListValues(value: string | undefined): string[] {
  const trimmed = value?.trim();
  if (!trimmed) return [];
  if (trimmed.startsWith("[")) {
    try {
      const parsed: unknown = JSON.parse(trimmed);
      if (Array.isArray(parsed)) {
        return parsed.flatMap((item) =>
          typeof item === "string" ? storedListValues(item) : [],
        );
      }
    } catch {
      // Not a JSON list: the raw value is the one entry.
    }
  }
  return [trimmed];
}

function foldedList(value: string | undefined) {
  const seen = new Set<string>();
  for (const item of storedListValues(value)) {
    const folded = foldFacetValue(item);
    if (folded) seen.add(folded);
  }
  return [...seen];
}

function clip(text: string, limit: number) {
  return text.length > limit ? text.slice(0, limit) : text;
}

function customFieldText(collection: Doc<"collections">) {
  return Object.values(collection.customFields ?? {})
    .flatMap((value) => {
      if (typeof value === "string") return [value];
      if (typeof value === "number") return [String(value)];
      if (Array.isArray(value)) return value;
      return [];
    })
    .join(" ");
}

/** What each searchable field says, empty fields left out. */
export function objectSearchFieldTexts(
  collection: Doc<"collections">,
): Array<{ field: ObjectSearchField; text: string }> {
  const texts: Partial<Record<ObjectSearchField, string>> = {
    accessionNumber: [
      collection.accessionNumber,
      ...(collection.alternateAccessionNumbers ?? []),
      ...(collection.accessionNumberHistory ?? []).map((entry) => entry.number),
    ].join(" "),
    title: collection.title,
    alternativeTitle: collection.alternativeTitle,
    creator: collection.creator,
    objectName: collection.objectName,
    objectType: storedListValues(collection.objectType).join(" "),
    description: clip(collection.description ?? "", DESCRIPTION_TEXT_LIMIT),
    tags: (collection.tags ?? []).join(" "),
    inscriptions: [
      collection.inscriptions,
      ...(collection.inscriptionMarks ?? []).map(
        (mark) => `${mark.label} ${mark.description}`,
      ),
    ]
      .filter(Boolean)
      .join(" "),
    materials: storedListValues(collection.materials).join(" "),
    technique: collection.technique,
    culture: collection.culture,
    period: collection.period,
    provenance: collection.provenance,
    customFields: customFieldText(collection),
  };
  return OBJECT_SEARCH_FIELDS.flatMap((field) => {
    const text = texts[field]?.trim();
    return text
      ? [
          {
            field,
            text: field === "description" ? text : clip(text, FIELD_TEXT_LIMIT),
          },
        ]
      : [];
  });
}

/** The document for an Object, given whether it has a photograph. */
export function composeObjectSearchDocument(
  collection: Doc<"collections">,
  hasImage: boolean,
): WithoutSystemFields<Doc<"objectSearchDocuments">> {
  return {
    organizationId: collection.organizationId,
    collectionId: collection._id,
    status: collection.status,
    text: objectSearchFieldTexts(collection)
      .map(({ text }) => text)
      .join("\n"),
    hasImage,
    culture: foldFacetValue(collection.culture),
    cultureLabel: collection.culture?.trim() || undefined,
    period: foldFacetValue(collection.period),
    periodLabel: collection.period?.trim() || undefined,
    condition: foldFacetValue(collection.condition),
    objectTypes: foldedList(collection.objectType),
    materials: foldedList(collection.materials),
    catalogedAt: collection.catalogedAt,
    version: OBJECT_SEARCH_DOCUMENT_VERSION,
  };
}

/** Whether the Object has a photograph of its own Organization. */
export async function collectionHasImage(
  ctx: Ctx,
  collection: Pick<Doc<"collections">, "_id" | "organizationId">,
) {
  const images = await ctx.db
    .query("mediaFiles")
    .withIndex("by_collection_and_fileType", (q) =>
      q.eq("collectionId", collection._id).eq("fileType", "image"),
    )
    .take(IMAGE_ROWS_CHECKED);
  return images.some(
    (image) =>
      image.organizationId === collection.organizationId &&
      image.uploadStatus !== "failed",
  );
}

export async function getObjectSearchDocument(
  ctx: Ctx,
  collectionId: Id<"collections">,
) {
  return await ctx.db
    .query("objectSearchDocuments")
    .withIndex("by_collection", (q) => q.eq("collectionId", collectionId))
    .first();
}

/** Writes the Object's document, replacing an earlier one. */
export async function syncObjectSearchDocument(
  ctx: MutationCtx,
  collection: Doc<"collections">,
) {
  const [existing, hasImage] = await Promise.all([
    getObjectSearchDocument(ctx, collection._id),
    collectionHasImage(ctx, collection),
  ]);
  const document = composeObjectSearchDocument(collection, hasImage);
  if (existing) {
    // Most writes to an Object change nothing searchable; an unchanged
    // document is left alone so facet and search readers don't re-run.
    const { _id, _creationTime, ...current } = existing;
    if (!sameDocument(current, document)) {
      await ctx.db.replace(existing._id, document);
    }
  } else {
    await ctx.db.insert("objectSearchDocuments", document);
  }
}

export async function removeObjectSearchDocument(
  ctx: MutationCtx,
  collectionId: Id<"collections">,
) {
  const existing = await getObjectSearchDocument(ctx, collectionId);
  if (existing) await ctx.db.delete(existing._id);
}

/** Re-reads whether the Object has a photograph after its media changed. */
export async function refreshObjectSearchDocumentImage(
  ctx: MutationCtx,
  collectionId: Id<"collections">,
) {
  const existing = await getObjectSearchDocument(ctx, collectionId);
  if (!existing) return;
  const hasImage = await collectionHasImage(ctx, {
    _id: collectionId,
    organizationId: existing.organizationId,
  });
  if (hasImage !== existing.hasImage) {
    await ctx.db.patch(existing._id, { hasImage });
  }
}

/**
 * Whether an Organization's documents are complete at the current version.
 * Until then the catalog searches records directly, as it did before.
 */
export async function isObjectSearchReady(
  ctx: Ctx,
  organizationId: Id<"organizations">,
) {
  const backfill = await ctx.db
    .query("objectSearchBackfills")
    .withIndex("by_organization", (q) => q.eq("organizationId", organizationId))
    .first();
  return (
    backfill !== null &&
    backfill.completedAt !== undefined &&
    backfill.version === OBJECT_SEARCH_DOCUMENT_VERSION
  );
}

function sameDocument(
  current: Record<string, unknown>,
  next: Record<string, unknown>,
) {
  const keys = new Set([...Object.keys(current), ...Object.keys(next)]);
  return [...keys].every(
    (key) => JSON.stringify(current[key]) === JSON.stringify(next[key]),
  );
}

/** Words of a text, lower-cased, as the search index splits them. */
export function searchTokens(text: string) {
  return text
    .toLowerCase()
    .split(/[^\p{L}\p{N}]+/u)
    .filter((token) => token.length > 0);
}

/**
 * The first field, in document order, that a search term matches, as the
 * search index matches: any term may match, each one a whole word except
 * the last, which may begin one. What a result row reports as its match.
 */
export function matchedObjectSearchField(
  collection: Doc<"collections">,
  search: string,
): ObjectSearchField | undefined {
  const terms = searchTokens(search);
  const last = terms.pop();
  if (last === undefined) return undefined;
  const whole = new Set(terms);
  for (const { field, text } of objectSearchFieldTexts(collection)) {
    if (
      searchTokens(text).some(
        (word) => whole.has(word) || word.startsWith(last),
      )
    )
      return field;
  }
  return undefined;
}
