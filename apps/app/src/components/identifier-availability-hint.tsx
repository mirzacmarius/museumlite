"use client";

import { api } from "@v1/backend/convex/_generated/api";
import type { Id } from "@v1/backend/convex/_generated/dataModel";
import { useQuery } from "convex/react";
import Link from "next/link";
import { useScopedI18n } from "@/locales/client";
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
  const t = useScopedI18n("identifiers");
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
          {t("hint.needsIndexing")}{" "}
          <Link className="underline" href="/settings/preferences">
            {t("hint.openReview")}
          </Link>
        </p>
      ) : null}
      {matches.length > 0 ? (
        <>
          <p>{t("hint.inUse", { register: t(`registers.${register}`) })}</p>
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
          {matches.length > 10 ? <p>{t("hint.moreMatches")}</p> : null}
        </>
      ) : null}
    </div>
  );
}
