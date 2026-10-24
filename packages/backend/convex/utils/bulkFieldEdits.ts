import { type Infer, v } from "convex/values";
import type { Doc } from "../_generated/dataModel";
import { bulkEditError } from "./bulkFieldEditErrors";
import { storedListValues } from "./objectSearchDocuments";

/** Text fields a bulk edit can set, clear or find-and-replace. */
export const BULK_EDIT_FIELDS = [
  "title",
  "alternativeTitle",
  "creator",
  "objectType",
  "objectName",
  "culture",
  "period",
  "dateCreated",
  "materials",
  "technique",
  "description",
  "inscriptions",
  "provenance",
  "exhibitionHistory",
  "creditLine",
  "acquisitionMethod",
] as const;

export type BulkEditField = (typeof BULK_EDIT_FIELDS)[number];

/** Fields stored as text or as a JSON list; a replace runs on each entry. */
const LIST_FIELDS: readonly BulkEditField[] = ["objectType", "materials"];

/** Characters a set value may have. */
export const BULK_EDIT_VALUE_LIMIT = 4000;

/** Objects a selection may hold; larger edits run over the catalog filters. */
export const BULK_EDIT_MAX_SELECTION = 500;

export const bulkEditFieldValidator = v.union(
  ...BULK_EDIT_FIELDS.map((field) => v.literal(field)),
);

export const bulkEditValidator = v.object({
  field: bulkEditFieldValidator,
  operation: v.union(
    v.literal("set"),
    v.literal("clear"),
    v.literal("replace"),
  ),
  value: v.optional(v.string()),
  find: v.optional(v.string()),
  replaceWith: v.optional(v.string()),
  /** Replace matches the find text's case too; otherwise any case matches. */
  matchCase: v.optional(v.boolean()),
});

export type BulkEdit = Infer<typeof bulkEditValidator>;

/** Refuses an edit that could not run as described. */
export function validateBulkEdit(edit: BulkEdit) {
  switch (edit.operation) {
    case "set": {
      const value = edit.value?.trim() ?? "";
      if (!value)
        throw bulkEditError("VALUE_REQUIRED", "Enter the value to set");
      if (value.length > BULK_EDIT_VALUE_LIMIT)
        throw bulkEditError(
          "VALUE_TOO_LONG",
          `Values have at most ${BULK_EDIT_VALUE_LIMIT} characters`,
        );
      return;
    }
    case "clear":
      if (edit.field === "title")
        throw bulkEditError("TITLE_REQUIRED", "Every Object has a title");
      return;
    case "replace":
      if (!edit.find)
        throw bulkEditError("FIND_REQUIRED", "Enter the text to find");
      return;
  }
}

function escapeRegExp(text: string) {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function replaceIn(text: string, edit: BulkEdit) {
  const find = edit.find ?? "";
  const replaceWith = edit.replaceWith ?? "";
  if (edit.matchCase) return text.split(find).join(replaceWith);
  return text.replace(new RegExp(escapeRegExp(find), "gi"), replaceWith);
}

/** A list keeps its stored shape: a JSON list stays one, a bare text stays text. */
function replaceInList(stored: string, edit: BulkEdit) {
  const entries = storedListValues(stored)
    .map((entry) => replaceIn(entry, edit).trim())
    .filter((entry) => entry.length > 0);
  if (entries.length === 0) return undefined;
  return stored.trim().startsWith("[") || entries.length > 1
    ? JSON.stringify(entries)
    : entries[0];
}

export interface BulkEditOutcome {
  before: string | undefined;
  after: string | undefined;
  changed: boolean;
  /** The edit would leave a required field empty, so the Object is left as is. */
  skipped: boolean;
}

/** What the edit does to one Object, without writing it. */
export function applyBulkEdit(
  collection: Doc<"collections">,
  edit: BulkEdit,
): BulkEditOutcome {
  const before = collection[edit.field];
  const unchanged = { before, after: before, changed: false, skipped: false };
  switch (edit.operation) {
    case "set": {
      const after = edit.value?.trim();
      return after === undefined || after === before
        ? unchanged
        : { before, after, changed: true, skipped: false };
    }
    case "clear":
      return before === undefined
        ? unchanged
        : { before, after: undefined, changed: true, skipped: false };
    case "replace": {
      if (before === undefined) return unchanged;
      const replaced = LIST_FIELDS.includes(edit.field)
        ? replaceInList(before, edit)
        : replaceIn(before, edit).trim() || undefined;
      if (replaced === before) return unchanged;
      if (replaced === undefined && edit.field === "title")
        return { before, after: before, changed: false, skipped: true };
      return { before, after: replaced, changed: true, skipped: false };
    }
  }
}

/** Whether the edit writes over a value the Object already holds. */
export function overwritesValue(outcome: BulkEditOutcome) {
  return outcome.changed && !!outcome.before?.trim();
}
