"use client";

import { api } from "@v1/backend/convex/_generated/api";
import type { Id } from "@v1/backend/convex/_generated/dataModel";
import { Button } from "@v1/ui/button";
import { Label } from "@v1/ui/label";
import { Textarea } from "@v1/ui/textarea";
import { useMutation, useQuery } from "convex/react";
import { ConvexError } from "convex/values";
import Link from "next/link";
import { useReducer, useState } from "react";
import { PermissionGate, usePermissions } from "@/components/permission-gate";

interface ReviewState {
  cursor: string | null;
  notes: Record<string, string>;
  message: string | null;
  error: string | null;
  isWorking: boolean;
}

type ReviewAction =
  | { type: "set-cursor"; cursor: string | null }
  | { type: "set-note"; recordId: string; note: string }
  | { type: "set-message"; message: string | null }
  | { type: "set-error"; error: string | null }
  | { type: "set-working"; isWorking: boolean };

const INITIAL_REVIEW_STATE: ReviewState = {
  cursor: null,
  notes: {},
  message: null,
  error: null,
  isWorking: false,
};

function reviewReducer(state: ReviewState, action: ReviewAction): ReviewState {
  switch (action.type) {
    case "set-cursor":
      return { ...state, cursor: action.cursor };
    case "set-note":
      return {
        ...state,
        notes: { ...state.notes, [action.recordId]: action.note },
      };
    case "set-message":
      return { ...state, message: action.message };
    case "set-error":
      return { ...state, error: action.error };
    case "set-working":
      return { ...state, isWorking: action.isWorking };
  }
}

export function IdentifierReview({
  organizationId,
}: {
  organizationId: Id<"organizations">;
}) {
  const [register, setRegister] = useState<"catalog" | "accession">("catalog");
  return (
    <PermissionGate permission="collections.read">
      <section className="space-y-4 rounded-lg border border-white/10 p-5">
        <h2 className="text-lg font-medium">Permanent identifier review</h2>
        <p className="text-sm text-muted-foreground">
          Primary numbers are unique within this organization and each register.
          Catalog and accession registers may reuse a number. Matching ignores
          capitalization and surrounding spaces and uses Unicode NFC;
          punctuation and leading zeros remain significant. Existing strings,
          withdrawn records and historical duplicates are preserved. Alternate
          historical references are evidence, not new primary assignments.
        </p>
        <div className="flex gap-2">
          <Button
            variant={register === "catalog" ? "default" : "outline"}
            onClick={() => setRegister("catalog")}
          >
            Catalog register
          </Button>
          <Button
            variant={register === "accession" ? "default" : "outline"}
            onClick={() => setRegister("accession")}
          >
            Accession register
          </Button>
        </div>
        <IdentifierRegisterReview
          key={`${organizationId}-${register}`}
          organizationId={organizationId}
          register={register}
        />
      </section>
    </PermissionGate>
  );
}

function IdentifierRegisterReview({
  organizationId,
  register,
}: {
  organizationId: Id<"organizations">;
  register: "catalog" | "accession";
}) {
  const { hasPermission } = usePermissions();
  const [state, dispatch] = useReducer(reviewReducer, INITIAL_REVIEW_STATE);
  const result = useQuery(api.identifiers.listConflicts, {
    organizationId,
    register,
    paginationOpts: { numItems: 10, cursor: state.cursor },
  });
  const indexLegacyBatch = useMutation(api.identifiers.indexLegacyBatch);
  const reviewConflict = useMutation(api.identifiers.reviewConflict);
  async function run(operation: () => Promise<void>) {
    dispatch({ type: "set-working", isWorking: true });
    dispatch({ type: "set-error", error: null });
    try {
      await operation();
    } catch (err) {
      dispatch({
        type: "set-error",
        error:
          err instanceof ConvexError && typeof err.data === "string"
            ? err.data
            : err instanceof Error
              ? err.message
              : "Identifier review failed. Retry the operation.",
      });
    } finally {
      dispatch({ type: "set-working", isWorking: false });
    }
  }
  return (
    <div className="space-y-4">
      {result?.needsBackfill ? (
        <div className="space-y-2">
          <p className="text-sm">
            Historical records still need additive search indexing. Conflict
            results are incomplete until indexing finishes. This operation
            preserves every original number.
          </p>
          {hasPermission("collections.update") ? (
            <Button
              type="button"
              disabled={state.isWorking}
              onClick={() =>
                run(async () => {
                  const batch = await indexLegacyBatch({
                    organizationId,
                    register,
                  });
                  dispatch({ type: "set-cursor", cursor: null });
                  dispatch({
                    type: "set-message",
                    message: `Indexed ${batch.processed} records. ${batch.hasMore ? "Continue with the next batch." : "Indexing complete."}`,
                  });
                })
              }
            >
              Index next 10 historical records
            </Button>
          ) : (
            <p className="text-sm">
              Ask staff with collections update permission to complete indexing.
            </p>
          )}
        </div>
      ) : null}
      {state.message ? (
        <p role="status" className="text-sm">
          {state.message}
        </p>
      ) : null}
      {state.error ? (
        <p role="alert" className="text-sm text-destructive">
          {state.error}
        </p>
      ) : null}
      {result === undefined ? (
        <p>Loading identifier conflicts…</p>
      ) : result.page.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No conflicts on this scanned page.
          {!result.isDone ? " Continue scanning the register." : ""}
        </p>
      ) : (
        result.page.map((row) => (
          <article
            key={row._id}
            className="space-y-3 rounded-md border border-white/10 p-4"
          >
            <Link
              href={`/${register === "catalog" ? "objects" : "accessions"}/${row._id}`}
              className="font-medium underline"
            >
              {row.identifier}
            </Link>
            <p className="text-sm">
              Historical entries share search key: {row.normalizedIdentifier}
            </p>
            <ul className="space-y-1 text-sm">
              {row.matches.map((match) => (
                <li key={match._id}>
                  <Link
                    className="underline"
                    href={`/${register === "catalog" ? "objects" : "accessions"}/${match._id}`}
                  >
                    {match.identifier}
                  </Link>
                </li>
              ))}
            </ul>
            {row.truncated ? (
              <p className="text-sm">
                First 10 matching records shown. Continue scanning to review
                each entry.
              </p>
            ) : null}
            {row.review ? (
              <p className="text-sm text-muted-foreground">
                Latest review: {row.review.note}. This acknowledgement preserves
                the conflict and does not permit reuse.
              </p>
            ) : null}
            {hasPermission("collections.update") ? (
              <form
                action={async () => {
                  await run(async () => {
                    await reviewConflict({
                      organizationId,
                      register,
                      recordId: row._id,
                      note: state.notes[row._id] ?? "",
                    });
                    dispatch({
                      type: "set-note",
                      recordId: row._id,
                      note: "",
                    });
                    dispatch({
                      type: "set-message",
                      message:
                        "Review saved. All historical identifiers remain unchanged.",
                    });
                  });
                }}
                className="space-y-2"
              >
                <Label htmlFor={`note-${row._id}`}>
                  Historical evidence and review note
                </Label>
                <Textarea
                  id={`note-${row._id}`}
                  value={state.notes[row._id] ?? ""}
                  maxLength={2000}
                  required
                  onChange={(event) =>
                    dispatch({
                      type: "set-note",
                      recordId: row._id,
                      note: event.target.value,
                    })
                  }
                />
                <Button
                  type="submit"
                  disabled={
                    state.isWorking ||
                    !state.notes[row._id]?.trim() ||
                    result.needsBackfill
                  }
                >
                  Record review acknowledgement
                </Button>
              </form>
            ) : null}
          </article>
        ))
      )}
      <div className="flex gap-2">
        <Button
          type="button"
          variant="outline"
          disabled={state.cursor === null || state.isWorking}
          onClick={() => dispatch({ type: "set-cursor", cursor: null })}
        >
          Start of register
        </Button>
        <Button
          type="button"
          variant="outline"
          disabled={!result || result.isDone || state.isWorking}
          onClick={() =>
            result &&
            dispatch({ type: "set-cursor", cursor: result.continueCursor })
          }
        >
          Scan next page
        </Button>
      </div>
    </div>
  );
}
