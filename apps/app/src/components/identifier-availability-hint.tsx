"use client";

import { api } from "@v1/backend/convex/_generated/api";
import type { Id } from "@v1/backend/convex/_generated/dataModel";
import { useQuery } from "convex/react";
import Link from "next/link";
import { usePermissions } from "./permission-gate";

export function IdentifierAvailabilityHint({
  organizationId,
  register,
  identifier,
  existingId,
}: {
  organizationId: Id<"organizations"> | null | undefined;
  register: "catalog" | "accession";
  identifier: string;
  existingId?: Id<"accessions">;
}) {
  const { hasPermission } = usePermissions();
  const result = useQuery(
    api.identifiers.inspect,
    organizationId && identifier.trim() && hasPermission("collections.read")
      ? { organizationId, register, identifier }
      : "skip",
  );
  if (!result) return null;
  const matches = result.matches.filter((row) => row._id !== existingId);
  return (
    <div className="space-y-1 text-xs" aria-live="polite">
      {result.needsBackfill ? (
        <p>
          Complete identifier indexing in{" "}
          <Link className="underline" href="/settings/preferences">
            Settings &gt; Preferences
          </Link>{" "}
          before assigning new numbers.
        </p>
      ) : null}
      {matches.length > 0 ? (
        <>
          <p>
            Existing {register} records use this number. For a new record,
            choose an unused number. Capitalization and surrounding spaces do
            not make a number unique.
          </p>
          <ul className="space-y-1">
            {matches.slice(0, 10).map((row) => (
              <li key={row._id}>
                <Link
                  className="underline"
                  href={`/${register === "catalog" ? "objects" : "accessions"}/${row._id}`}
                >
                  {row.identifier}
                </Link>
              </li>
            ))}
          </ul>
          {matches.length > 10 ? (
            <p>More matches are available in identifier review.</p>
          ) : null}
        </>
      ) : null}
    </div>
  );
}
