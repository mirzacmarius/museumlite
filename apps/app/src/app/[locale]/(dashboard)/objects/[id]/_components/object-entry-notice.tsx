"use client";

import { api } from "@v1/backend/convex/_generated/api";
import type { Id } from "@v1/backend/convex/_generated/dataModel";
import { useQuery } from "convex/react";
import Link from "next/link";
import { useScopedI18n } from "@/locales/client";

/** States the custody basis of an object received under an entry. */
export function ObjectEntryNotice({
  collectionId,
}: {
  collectionId: Id<"collections">;
}) {
  const t = useScopedI18n("objectEntries");
  const entry = useQuery(api.objectEntries.getForObject, { collectionId });
  if (!entry) return null;
  const entryLink = (
    <Link
      href={`/accessions/entries/${entry._id}`}
      className="text-sm font-medium text-primary underline-offset-2 hover:underline"
    >
      {t("objectNotice.openEntry")}
    </Link>
  );

  if (entry.status === "in_custody" || entry.status === "acquisition_review") {
    return (
      <section
        aria-label={t("objectNotice.temporary")}
        className="border-b border-sky-500/20 bg-sky-500/5 px-6 py-4"
      >
        <h2 className="text-sm font-semibold text-foreground">
          {t("objectNotice.temporary")}
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          {t("objectNotice.temporaryDetail", {
            entryNumber: entry.entryNumber,
            purpose: t(`purposes.${entry.purpose}`),
            depositor: entry.depositorName,
          })}{" "}
          {entryLink}
        </p>
      </section>
    );
  }

  return (
    <p className="border-b border-border/60 px-6 py-2 text-xs text-muted-foreground">
      {t(
        entry.status === "accessioned"
          ? "objectNotice.accessioned"
          : "objectNotice.exited",
        { entryNumber: entry.entryNumber },
      )}{" "}
      {entryLink}
    </p>
  );
}
