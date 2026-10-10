/**
 * Shared contract for operational forms that edit one record. Staff edit
 * against the version of the record they opened (its `editVersion`), keep
 * their input when a colleague saves or a save fails, and can reapply their
 * changes on top of the latest version. The server stays authoritative: it
 * refuses a save based on an older version with EDIT_CONFLICT.
 */

import type { ZodError } from "zod";

/** A record as the form sees it, with the server version it was read at. */
export interface RecordFormSnapshot<V> {
  values: V;
  /** Null until the record exists (a form creating it). */
  editVersion: string | null;
}

/**
 * Projects form values to what staff can see, keyed by field name, so that
 * local-only details (row ids, empty placeholders) never count as changes.
 */
export type ComparableValues<V> = (values: V) => Record<string, unknown>;

/** What a failed save means for the person filling in the form. */
export type RecordSaveFailure =
  | { kind: "conflict"; message: string }
  | { kind: "invalid"; message: string; fields: string[] }
  | { kind: "field"; message: string; field: string }
  | { kind: "denied"; message: string }
  | { kind: "locked"; message: string }
  /** Refused for a reason retrying will not change. */
  | { kind: "rejected"; message: string }
  /** Not saved for an unknown or passing reason; retrying may work. */
  | { kind: "failed"; message: string };

/** The first message for each top-level field a Zod check rejected. */
export function fieldErrorsFromZod(error: ZodError): Record<string, string> {
  const errors: Record<string, string> = {};
  for (const issue of error.issues) {
    const field = issue.path[0];
    if (typeof field === "string" && !(field in errors))
      errors[field] = issue.message;
  }
  return errors;
}

/** JSON with sorted object keys, so equal values always serialize alike. */
export function stableStringify(value: unknown): string {
  if (Array.isArray(value)) {
    return `[${value.map((item) => stableStringify(item ?? null)).join(",")}]`;
  }
  if (value !== null && typeof value === "object") {
    const entries = Object.entries(value)
      .filter(([, item]) => item !== undefined)
      .sort(([left], [right]) => (left < right ? -1 : left > right ? 1 : 0))
      .map(([key, item]) => `${JSON.stringify(key)}:${stableStringify(item)}`);
    return `{${entries.join(",")}}`;
  }
  return JSON.stringify(value ?? null);
}

/** Fields whose visible values differ between two states of a form. */
export function differingFields<V>(
  left: V,
  right: V,
  comparable: ComparableValues<V>,
): string[] {
  const leftValues = comparable(left);
  const rightValues = comparable(right);
  return [...new Set([...Object.keys(leftValues), ...Object.keys(rightValues)])]
    .filter(
      (field) =>
        stableStringify(leftValues[field]) !==
        stableStringify(rightValues[field]),
    )
    .sort();
}

function withField<V>(values: V, field: string, value: unknown): V {
  return { ...values, [field]: value };
}

function fieldOf<V>(values: V, field: string): unknown {
  return (values as Record<string, unknown>)[field];
}

/** The latest values with the fields I changed since `base` applied on top. */
export function rebaseOnto<V>(
  mine: V,
  base: V,
  latest: V,
  comparable: ComparableValues<V>,
): V {
  return differingFields(mine, base, comparable).reduce(
    (values, field) => withField(values, field, fieldOf(mine, field)),
    latest,
  );
}

/** Input recovered from this device after an interruption. */
export interface RecoveredInput<V> {
  savedAt: number;
  base: RecordFormSnapshot<V>;
  values: V;
}

export interface RecordFormState<V> {
  /** The record version the current input is based on. */
  base: RecordFormSnapshot<V> | null;
  values: V;
  /** Recovered input waiting for staff to restore or discard it. */
  recovered: RecoveredInput<V> | null;
  /** Fields both I and a colleague changed, with the colleague's value. */
  overlaps: Record<string, unknown>;
  saving: boolean;
  failure: RecordSaveFailure | null;
  /** Server and client field messages, cleared when the field is edited. */
  fieldErrors: Record<string, string>;
}

export type RecordFormAction<V> =
  | {
      type: "sync";
      latest: RecordFormSnapshot<V>;
      recovered: RecoveredInput<V> | null;
    }
  | { type: "update"; update: (values: V) => V }
  | { type: "applyLatest"; latest: RecordFormSnapshot<V> }
  | { type: "discardChanges"; latest: RecordFormSnapshot<V> }
  | { type: "takeTheirValue"; field: string }
  | { type: "keepMyValue"; field: string }
  | { type: "restoreRecovered"; latest: RecordFormSnapshot<V> }
  | { type: "discardRecovered" }
  | { type: "saveStarted" }
  | {
      type: "saveSucceeded";
      /** The input as it was sent. */
      sent: V;
      /** The record as saved, when the save added to the input. */
      saved: V;
      editVersion: string;
    }
  | {
      type: "saveFailed";
      failure: RecordSaveFailure;
      fieldErrors: Record<string, string>;
    };

export function initialRecordFormState<V>(values: V): RecordFormState<V> {
  return {
    base: null,
    values,
    recovered: null,
    overlaps: {},
    saving: false,
    failure: null,
    fieldErrors: {},
  };
}

/**
 * Applies form events. `comparable` decides which differences staff can see;
 * hidden differences never block or interrupt anyone.
 */
export function recordFormReducer<V>(
  comparable: ComparableValues<V>,
): (
  state: RecordFormState<V>,
  action: RecordFormAction<V>,
) => RecordFormState<V> {
  return (state, action) => {
    switch (action.type) {
      case "sync": {
        const { latest } = action;
        if (state.base === null) {
          return {
            ...state,
            base: latest,
            values: latest.values,
            recovered: action.recovered,
          };
        }
        if (latest.editVersion === state.base.editVersion) return state;
        const isDirty =
          differingFields(state.values, state.base.values, comparable).length >
          0;
        if (!isDirty) return { ...state, base: latest, values: latest.values };
        // A change the form cannot show needs no review; adopt its version.
        if (
          differingFields(latest.values, state.base.values, comparable)
            .length === 0
        ) {
          return {
            ...state,
            base: { ...state.base, editVersion: latest.editVersion },
          };
        }
        return state;
      }
      case "update": {
        const values = action.update(state.values);
        const edited = new Set(
          differingFields(values, state.values, comparable),
        );
        return {
          ...state,
          values,
          fieldErrors: Object.fromEntries(
            Object.entries(state.fieldErrors).filter(
              ([field]) => !edited.has(field),
            ),
          ),
          failure:
            state.failure?.kind === "field" && edited.has(state.failure.field)
              ? null
              : state.failure,
        };
      }
      case "applyLatest": {
        if (!state.base) return state;
        const { latest } = action;
        const mine = differingFields(
          state.values,
          state.base.values,
          comparable,
        );
        const theirs = new Set(
          differingFields(latest.values, state.base.values, comparable),
        );
        const overlaps = Object.fromEntries(
          mine.flatMap((field) =>
            theirs.has(field) ? [[field, fieldOf(latest.values, field)]] : [],
          ),
        );
        return {
          ...state,
          base: latest,
          values: rebaseOnto(
            state.values,
            state.base.values,
            latest.values,
            comparable,
          ),
          overlaps: { ...state.overlaps, ...overlaps },
          failure: state.failure?.kind === "conflict" ? null : state.failure,
        };
      }
      case "discardChanges":
        return {
          ...state,
          base: action.latest,
          values: action.latest.values,
          overlaps: {},
          failure: null,
          fieldErrors: {},
        };
      case "takeTheirValue": {
        if (!(action.field in state.overlaps)) return state;
        const { [action.field]: theirValue, ...overlaps } = state.overlaps;
        return {
          ...state,
          values: withField(state.values, action.field, theirValue),
          overlaps,
        };
      }
      case "keepMyValue": {
        const { [action.field]: _kept, ...overlaps } = state.overlaps;
        return { ...state, overlaps };
      }
      case "restoreRecovered": {
        const { recovered } = state;
        if (!recovered) return state;
        const { latest } = action;
        // Unchanged since the input was saved: continue as if never left.
        if (recovered.base.editVersion === latest.editVersion) {
          return {
            ...state,
            base: latest,
            values: rebaseOnto(
              recovered.values,
              recovered.base.values,
              latest.values,
              comparable,
            ),
            recovered: null,
          };
        }
        // Changed since: restore against the old version so the colleague's
        // changes show up for review before anything is saved.
        return {
          ...state,
          base: recovered.base,
          values: recovered.values,
          recovered: null,
        };
      }
      case "discardRecovered":
        return { ...state, recovered: null };
      case "saveStarted":
        return { ...state, saving: true, failure: null };
      case "saveSucceeded":
        return {
          ...state,
          saving: false,
          base: { values: action.saved, editVersion: action.editVersion },
          // Keep anything typed while the save was in flight.
          values: rebaseOnto(
            state.values,
            action.sent,
            action.saved,
            comparable,
          ),
          overlaps: {},
          failure: null,
          fieldErrors: {},
        };
      case "saveFailed":
        return {
          ...state,
          saving: false,
          failure: action.failure,
          fieldErrors: action.fieldErrors,
        };
    }
  };
}
