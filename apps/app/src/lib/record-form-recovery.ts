import type { RecoveredInput } from "./record-form";

/**
 * Unsaved form input kept on this device so an interruption (a reload, an
 * expired session, a crash) does not erase it. Keys carry the format version,
 * the staff member and the organization; entries expire after a week and are
 * cleared at sign-out. Nothing here is sent to the server.
 */
const RECOVERY_PREFIX = "museumlite.form-recovery.v1:";
const RECOVERY_TTL_MS = 7 * 24 * 60 * 60 * 1000;

export type RecordFormKind = "object" | "objectDraft" | "loan";

export interface RecordFormRecoveryKey {
  userId: string;
  organizationId: string;
  kind: RecordFormKind;
  /** The record id, or "new" for a record not created yet. */
  recordId: string;
}

function storageKey(key: RecordFormRecoveryKey) {
  return `${RECOVERY_PREFIX}${key.userId}:${key.organizationId}:${key.kind}:${key.recordId}`;
}

function storage(): Storage | null {
  try {
    return typeof window === "undefined" ? null : window.localStorage;
  } catch {
    // Storage can be blocked (private browsing, policies); forms still work.
    return null;
  }
}

interface StoredRecovery {
  savedAt: number;
  base: { values: unknown; editVersion: string | null };
  values: unknown;
}

function isStoredRecovery(value: unknown): value is StoredRecovery {
  if (typeof value !== "object" || value === null) return false;
  const entry = value as Record<string, unknown>;
  const base = entry.base as Record<string, unknown> | null | undefined;
  return (
    typeof entry.savedAt === "number" &&
    typeof base === "object" &&
    base !== null &&
    (typeof base.editVersion === "string" || base.editVersion === null) &&
    "values" in base &&
    "values" in entry
  );
}

/**
 * Recovered input for this form, or null when there is none, it expired, or
 * it no longer parses as this form's values.
 */
export function readRecoveredInput<V>(
  key: RecordFormRecoveryKey,
  parse: (stored: unknown) => V | null,
  now: number,
): RecoveredInput<V> | null {
  const store = storage();
  if (!store) return null;
  const raw = store.getItem(storageKey(key));
  if (raw === null) return null;
  try {
    const entry: unknown = JSON.parse(raw);
    if (isStoredRecovery(entry) && now - entry.savedAt < RECOVERY_TTL_MS) {
      const values = parse(entry.values);
      const baseValues = parse(entry.base.values);
      if (values !== null && baseValues !== null) {
        return {
          savedAt: entry.savedAt,
          base: { values: baseValues, editVersion: entry.base.editVersion },
          values,
        };
      }
    }
  } catch {
    // Unreadable entries are dropped below.
  }
  store.removeItem(storageKey(key));
  return null;
}

export function writeRecoveredInput<V>(
  key: RecordFormRecoveryKey,
  input: RecoveredInput<V>,
) {
  try {
    storage()?.setItem(storageKey(key), JSON.stringify(input));
  } catch {
    // A full or blocked store only loses the device copy.
  }
}

export function removeRecoveredInput(key: RecordFormRecoveryKey) {
  storage()?.removeItem(storageKey(key));
}

/** Removes every recovered form input on this device, e.g. at sign-out. */
export function clearRecoveredInputs() {
  const store = storage();
  if (!store) return;
  const keys = Array.from({ length: store.length }, (_, index) =>
    store.key(index),
  ).filter((key): key is string => key?.startsWith(RECOVERY_PREFIX) ?? false);
  for (const key of keys) store.removeItem(key);
}
