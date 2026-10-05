"use client";

import { api } from "@v1/backend/convex/_generated/api";
import type { Id } from "@v1/backend/convex/_generated/dataModel";
import { Button } from "@v1/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@v1/ui/card";
import { useQuery } from "convex/react";
import { useState } from "react";
import { usePermissions } from "@/components/permission-gate";
import { useFeatureAccess } from "@/hooks/use-feature-access";

const reviewKinds = [
  { kind: "collections", label: "Objects", permission: "collections.read" },
  { kind: "media", label: "Media and versions", permission: "media.read" },
  {
    kind: "accessions",
    label: "Accessions and attachments",
    permission: "collections.read",
  },
  {
    kind: "locations",
    label: "Locations and images",
    permission: "locations.read",
  },
  {
    kind: "exhibitions",
    label: "Exhibitions and attachments",
    permission: "collections.read",
  },
  {
    kind: "loans",
    label: "Loan documents and condition photos",
    permission: "loans.read",
  },
  { kind: "accounts", label: "Account documents", permission: "accounts.read" },
  { kind: "library", label: "Library covers", permission: "collections.read" },
  {
    kind: "relationships",
    label: "Account relationships",
    permission: "accounts.read",
  },
] as const;

type ReviewKind = (typeof reviewKinds)[number]["kind"];

function IntegrityResults({
  organizationId,
  kind,
}: {
  organizationId: Id<"organizations">;
  kind: ReviewKind;
}) {
  const [cursors, setCursors] = useState<Array<string | null>>([null]);
  const result = useQuery(api.media.reviewIntegrity, {
    organizationId,
    kind,
    paginationOpts: {
      cursor: cursors[cursors.length - 1] ?? null,
      numItems: 25,
    },
  });
  if (!result)
    return (
      <p className="text-sm text-muted-foreground" role="status">
        Checking records…
      </p>
    );
  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground" role="status">
        Checked {result.checkedCount} records on this page.{" "}
        {result.issues.length} issues require review.
      </p>
      {result.issues.length > 0 ? (
        <ul className="divide-y divide-white/10 rounded-md border border-white/10">
          {result.issues.map((issue) => (
            <li
              key={`${issue.recordId}:${issue.referencedId}:${issue.recordLabel}:${issue.issue}`}
              className="space-y-1 p-3 text-sm"
            >
              <p className="font-medium">{issue.recordLabel}</p>
              <p>{issue.issue}</p>
              <p className="break-all text-xs text-muted-foreground">
                Record: {issue.recordId} · Reference: {issue.referencedId}
              </p>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm">No issues found on this page.</p>
      )}
      <div className="flex gap-2">
        <Button
          variant="outline"
          disabled={cursors.length === 1}
          onClick={() => setCursors((current) => current.slice(0, -1))}
        >
          Previous page
        </Button>
        <Button
          variant="outline"
          disabled={result.isDone}
          onClick={() =>
            setCursors((current) => [...current, result.continueCursor])
          }
        >
          Next page
        </Button>
      </div>
    </div>
  );
}

export function DataIntegrityReview({
  organizationId,
}: {
  organizationId: Id<"organizations">;
}) {
  const { hasPermission, isLoading } = usePermissions();
  const { hasFeature, hasModule } = useFeatureAccess();
  const availableKinds = reviewKinds.filter(
    (option) =>
      hasPermission(option.permission) &&
      (option.kind !== "library" || hasModule("library")) &&
      (!["accounts", "relationships"].includes(option.kind) ||
        hasModule("accounts")) &&
      (option.kind !== "loans" || hasFeature("loans")) &&
      (option.kind !== "exhibitions" || hasFeature("exhibitions")),
  );
  const [selection, setSelection] = useState<ReviewKind>("collections");
  const selected =
    availableKinds.find((option) => option.kind === selection) ??
    availableKinds[0];
  if (isLoading || !selected) return null;
  return (
    <Card>
      <CardHeader>
        <CardTitle>Record integrity review</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground">
          Review missing or foreign references and files whose upload ownership
          has not been verified. Existing files and records are retained.
          Confirm the source before replacing an attachment; this review does
          not assign ownership or repair records automatically.
        </p>
        <label className="flex flex-col gap-2 text-sm">
          Record type
          <select
            className="h-9 rounded-md border border-white/10 bg-background px-3"
            value={selected.kind}
            onChange={(event) => {
              const option = availableKinds.find(
                (option) => option.kind === event.target.value,
              );
              if (option) setSelection(option.kind);
            }}
          >
            {availableKinds.map((option) => (
              <option key={option.kind} value={option.kind}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
        <IntegrityResults
          key={`${organizationId}:${selected.kind}`}
          organizationId={organizationId}
          kind={selected.kind}
        />
      </CardContent>
    </Card>
  );
}
