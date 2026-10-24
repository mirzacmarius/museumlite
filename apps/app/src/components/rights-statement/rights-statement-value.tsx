"use client";

import { ExternalLink } from "lucide-react";
import type { ShownRightsStatement } from "@/lib/rights-statements";
import { useI18n } from "@/locales/client";
import { useRightsStatementName } from "./use-rights-statement-name";

/**
 * The statement in effect, linked to its publisher's page, and whether it is
 * the Organization's default rather than the record's own.
 */
export function RightsStatementValue({
  shown: { statement, inherited },
}: {
  shown: ShownRightsStatement;
}) {
  const tRoot = useI18n();
  const name = useRightsStatementName();
  return (
    <div className="grid gap-1">
      <a
        href={statement.uri}
        target="_blank"
        rel="license noopener noreferrer"
        className="inline-flex items-start gap-1 break-words text-sm text-foreground underline-offset-4 hover:underline"
      >
        {name(statement.uri)}
        <ExternalLink className="mt-0.5 size-3 shrink-0" aria-hidden />
      </a>
      {inherited ? (
        <span className="text-xs text-muted-foreground">
          {tRoot("rightsStatements.inherited")}
        </span>
      ) : null}
    </div>
  );
}
