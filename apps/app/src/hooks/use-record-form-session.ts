"use client";

import { api } from "@v1/backend/convex/_generated/api";
import { useQuery } from "convex/react";
import { useCallback, useEffect, useMemo, useReducer, useRef } from "react";
import { useOrganization } from "@/components/organization-provider";
import {
  type ComparableValues,
  differingFields,
  initialRecordFormState,
  type RecordFormSnapshot,
  type RecordSaveFailure,
  recordFormReducer,
} from "@/lib/record-form";
import {
  type RecordFormKind,
  type RecordFormRecoveryKey,
  readRecoveredInput,
  removeRecoveredInput,
  writeRecoveredInput,
} from "@/lib/record-form-recovery";

export interface RecordSaveRequest<V> {
  values: V;
  /** Fields that differ from the version the input is based on. */
  changedFields: string[];
  /** Pass to the save mutation; undefined while the record does not exist. */
  expectedEditVersion: string | undefined;
}

export type RecordSaveRun<V> = (request: RecordSaveRequest<V>) => Promise<{
  editVersion: string;
  /** The values now saved, when the save added to them (e.g. uploads). */
  values?: V;
}>;

export interface RecordFormSessionOptions<V> {
  /** The record as the server has it now; undefined while it loads. */
  latest: RecordFormSnapshot<V> | undefined;
  /** Values to show before the record has loaded. */
  initialValues: V;
  /** Stable (module-level) projection of what staff can see per field. */
  comparable: ComparableValues<V>;
  /** Keeps unsaved input on this device; null keeps nothing. */
  recovery: {
    kind: RecordFormKind;
    /** The record id, or "new" before the record exists. */
    recordId: string;
    /** Stable (module-level) narrowing of stored input to form values. */
    parse: (stored: unknown) => V | null;
  } | null;
  /** Client-side checks, field to message; the server still decides. */
  validate?: (values: V) => Record<string, string>;
  /** From `useRecordSaveFailure`. */
  describeFailure: (error: unknown) => RecordSaveFailure;
  /** Message for the summary when client-side checks fail. */
  invalidMessage: string;
}

/**
 * State for a form that edits one record: the input, what changed, what
 * colleagues changed meanwhile, recovered input after an interruption, and
 * the save lifecycle. See `lib/record-form.ts` for the contract.
 */
export function useRecordFormSession<V>({
  latest,
  initialValues,
  comparable,
  recovery,
  validate,
  describeFailure,
  invalidMessage,
}: RecordFormSessionOptions<V>) {
  const reducer = useMemo(() => recordFormReducer(comparable), [comparable]);
  const [state, dispatch] = useReducer(
    reducer,
    initialValues,
    initialRecordFormState,
  );
  const user = useQuery(api.users.getUser);
  const { currentOrganizationId } = useOrganization();

  const recoveryKind = recovery?.kind;
  const recoveryRecordId = recovery?.recordId;
  const parse = recovery?.parse;
  const recoveryKey = useMemo((): RecordFormRecoveryKey | null | undefined => {
    if (!recoveryKind || !recoveryRecordId) return null;
    if (user === undefined) return undefined;
    if (user === null || !currentOrganizationId) return null;
    return {
      userId: user._id,
      organizationId: currentOrganizationId,
      kind: recoveryKind,
      recordId: recoveryRecordId,
    };
  }, [currentOrganizationId, recoveryKind, recoveryRecordId, user]);
  const hasBase = state.base !== null;
  useEffect(() => {
    if (!latest || recoveryKey === undefined) return;
    if (hasBase) {
      dispatch({ type: "sync", latest, recovered: null });
      return;
    }
    const recovered =
      recoveryKey && parse
        ? readRecoveredInput(recoveryKey, parse, Date.now())
        : null;
    const worthOffering =
      recovered !== null &&
      differingFields(recovered.values, latest.values, comparable).length > 0;
    if (recovered && !worthOffering && recoveryKey)
      removeRecoveredInput(recoveryKey);
    dispatch({
      type: "sync",
      latest,
      recovered: worthOffering ? recovered : null,
    });
  }, [comparable, hasBase, latest, parse, recoveryKey]);

  const dirtyFields = useMemo(
    () =>
      state.base
        ? differingFields(state.values, state.base.values, comparable)
        : [],
    [comparable, state.base, state.values],
  );
  const isDirty = dirtyFields.length > 0;

  // Keep the device copy in step with unsaved input, but never overwrite
  // recovered input that staff have not restored or discarded yet.
  useEffect(() => {
    if (!recoveryKey || !state.base || state.recovered) return;
    if (isDirty) {
      writeRecoveredInput(recoveryKey, {
        savedAt: Date.now(),
        base: state.base,
        values: state.values,
      });
    } else {
      removeRecoveredInput(recoveryKey);
    }
  }, [isDirty, recoveryKey, state.base, state.recovered, state.values]);

  const remote = useMemo(() => {
    if (!latest || !state.base || latest.editVersion === state.base.editVersion)
      return null;
    const changedFields = differingFields(
      latest.values,
      state.base.values,
      comparable,
    );
    if (changedFields.length === 0) return null;
    const mine = new Set(dirtyFields);
    return {
      changedFields,
      overlappingFields: changedFields.filter((field) => mine.has(field)),
    };
  }, [comparable, dirtyFields, latest, state.base]);

  const recoveryOffer = useMemo(() => {
    if (!state.recovered || !latest) return null;
    return {
      savedAt: state.recovered.savedAt,
      fields: differingFields(
        state.recovered.values,
        latest.values,
        comparable,
      ),
      recordChanged: state.recovered.base.editVersion !== latest.editVersion,
    };
  }, [comparable, latest, state.recovered]);

  const lastSaveRef = useRef<{
    run: RecordSaveRun<V>;
    afterSave?: () => void;
  } | null>(null);
  const { base, values } = state;

  /**
   * Saves the input with `run`, then calls `afterSave` (e.g. to open the
   * record). A retry repeats both, so it does what staff first asked for.
   */
  const save = useCallback(
    async (run: RecordSaveRun<V>, afterSave?: () => void): Promise<boolean> => {
      lastSaveRef.current = { run, afterSave };
      if (!base) return false;
      const invalid = validate?.(values) ?? {};
      const invalidFields = Object.keys(invalid);
      if (invalidFields.length > 0) {
        dispatch({
          type: "saveFailed",
          failure: {
            kind: "invalid",
            message: invalidMessage,
            fields: invalidFields,
          },
          fieldErrors: invalid,
        });
        return false;
      }
      dispatch({ type: "saveStarted" });
      try {
        const result = await run({
          values,
          changedFields: differingFields(values, base.values, comparable),
          expectedEditVersion: base.editVersion ?? undefined,
        });
        dispatch({
          type: "saveSucceeded",
          sent: values,
          saved: result.values ?? values,
          editVersion: result.editVersion,
        });
        afterSave?.();
        return true;
      } catch (error) {
        const failure = describeFailure(error);
        dispatch({
          type: "saveFailed",
          failure,
          fieldErrors:
            failure.kind === "field"
              ? { [failure.field]: failure.message }
              : {},
        });
        return false;
      }
    },
    [base, comparable, describeFailure, invalidMessage, validate, values],
  );

  const retry = useCallback(async () => {
    const last = lastSaveRef.current;
    return last ? save(last.run, last.afterSave) : false;
  }, [save]);

  return {
    ready: state.base !== null,
    values: state.values,
    /** The values of the record version the input is based on. */
    baseValues: state.base?.values ?? null,
    update: useCallback(
      (update: (values: V) => V) => dispatch({ type: "update", update }),
      [],
    ),
    isDirty,
    remote,
    overlaps: state.overlaps,
    applyLatest: useCallback(() => {
      if (latest) dispatch({ type: "applyLatest", latest });
    }, [latest]),
    discardChanges: useCallback(() => {
      if (latest) dispatch({ type: "discardChanges", latest });
    }, [latest]),
    /** Staff left without saving: drop the input and its device copy. */
    forgetInput: useCallback(() => {
      if (recoveryKey) removeRecoveredInput(recoveryKey);
      if (latest) dispatch({ type: "discardChanges", latest });
    }, [latest, recoveryKey]),
    takeTheirValue: useCallback(
      (field: string) => dispatch({ type: "takeTheirValue", field }),
      [],
    ),
    keepMyValue: useCallback(
      (field: string) => dispatch({ type: "keepMyValue", field }),
      [],
    ),
    recoveryOffer,
    restoreRecovered: useCallback(() => {
      if (latest) dispatch({ type: "restoreRecovered", latest });
    }, [latest]),
    discardRecovered: useCallback(() => {
      if (recoveryKey) removeRecoveredInput(recoveryKey);
      dispatch({ type: "discardRecovered" });
    }, [recoveryKey]),
    saving: state.saving,
    failure: state.failure,
    fieldErrors: state.fieldErrors,
    /** Whether unsaved input is also kept on this device. */
    keepsDeviceCopy: Boolean(recoveryKey),
    save,
    retry,
  };
}

export type RecordFormSession<V> = ReturnType<typeof useRecordFormSession<V>>;
