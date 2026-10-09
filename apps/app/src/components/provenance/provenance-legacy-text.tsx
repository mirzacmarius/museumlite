"use client";

import { Button } from "@v1/ui/button";
import { History } from "lucide-react";
import { useScopedI18n } from "@/locales/client";
import type { ClaimDefaults } from "./claim-form-state";

export interface LegacyOwnershipEntry {
  owner: string;
  startYear?: string;
  endYear?: string;
  description?: string;
}

function plainYear(text: string | undefined) {
  const value = text?.trim();
  return value && /^\d{1,4}$/.test(value) && Number(value) > 0
    ? { precision: "year" as const, year: Number(value) }
    : undefined;
}

/**
 * Prefills a claim from a legacy ownership entry. Staff review every field
 * before saving; only plain years become dates.
 */
export function claimDefaultsFromOwnership(
  entry: LegacyOwnershipEntry,
): ClaimDefaults {
  const period = [entry.startYear?.trim(), entry.endYear?.trim()]
    .filter(Boolean)
    .join(" – ");
  return {
    statement: [entry.owner, period, entry.description?.trim()]
      .filter(Boolean)
      .join(", "),
    partyKind: "named",
    partyText: entry.owner,
    startDate: plainYear(entry.startYear),
    endDate: plainYear(entry.endYear),
  };
}

/**
 * Unstructured provenance recorded before claims, kept as written, with a
 * way to record a claim from it.
 */
export function ProvenanceLegacyText({
  provenance,
  ownershipHistory,
  canRecord,
  onRecord,
}: {
  provenance?: string;
  ownershipHistory?: LegacyOwnershipEntry[];
  canRecord: boolean;
  onRecord: (defaults: ClaimDefaults) => void;
}) {
  const t = useScopedI18n("provenance.legacy");
  const entries = ownershipHistory ?? [];
  if (!provenance?.trim() && entries.length === 0) return null;
  return (
    <section className="space-y-3 rounded-xl border border-dashed border-border p-5">
      <div className="space-y-1">
        <h3 className="flex items-center gap-2 text-sm font-medium">
          <History className="size-4 text-muted-foreground" />
          {t("title")}
        </h3>
        <p className="text-xs text-muted-foreground">{t("description")}</p>
      </div>
      {provenance?.trim() ? (
        <div className="flex flex-wrap items-start justify-between gap-3">
          <p className="min-w-0 flex-1 whitespace-pre-wrap text-sm text-muted-foreground">
            {provenance}
          </p>
          {canRecord ? (
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => onRecord({ statement: provenance.trim() })}
            >
              {t("recordFrom")}
            </Button>
          ) : null}
        </div>
      ) : null}
      {entries.length > 0 ? (
        <ul className="space-y-2">
          {entries.map((entry) => (
            <li
              key={`${entry.owner}-${entry.startYear ?? ""}-${entry.endYear ?? ""}`}
              className="flex flex-wrap items-start justify-between gap-3 rounded-lg border border-border/60 p-3 text-sm"
            >
              <div className="min-w-0 space-y-0.5">
                <p className="font-medium">{entry.owner}</p>
                {entry.startYear || entry.endYear ? (
                  <p className="font-mono text-xs text-muted-foreground">
                    {[entry.startYear, entry.endYear]
                      .filter(Boolean)
                      .join(" – ")}
                  </p>
                ) : null}
                {entry.description ? (
                  <p className="text-muted-foreground">{entry.description}</p>
                ) : null}
              </div>
              {canRecord ? (
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => onRecord(claimDefaultsFromOwnership(entry))}
                >
                  {t("recordFrom")}
                </Button>
              ) : null}
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}
