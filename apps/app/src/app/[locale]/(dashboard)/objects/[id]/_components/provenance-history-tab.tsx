"use client";

import { Link as LinkIcon } from "lucide-react";
import { ProvenanceClaimsPanel } from "@/components/provenance/provenance-claims-panel";
import { useI18n } from "@/locales/client";
import type { CollectionData } from "./types";

interface ProvenanceHistoryTabProps {
  collection: CollectionData;
}

export function ProvenanceHistoryTab({
  collection,
}: ProvenanceHistoryTabProps) {
  const tRoot = useI18n();
  const hasLinks = Boolean(collection.links && collection.links.length > 0);

  return (
    <div className="space-y-8">
      <ProvenanceClaimsPanel
        objectId={collection._id}
        organizationId={collection.organizationId}
        legacyProvenance={collection.provenance}
        legacyOwnership={collection.ownershipHistory}
      />

      {collection.exhibitionHistory || hasLinks ? (
        <div className="grid grid-cols-1 gap-6 rounded-xl border border-border/60 bg-secondary/20 p-6 md:grid-cols-2">
          {collection.exhibitionHistory ? (
            <div className="grid gap-2">
              <div className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                {tRoot("objects.form.exhibitionHistory")}
              </div>
              <p className="whitespace-pre-wrap text-sm leading-relaxed text-muted-foreground">
                {collection.exhibitionHistory}
              </p>
            </div>
          ) : null}

          {hasLinks ? (
            <div className="grid gap-2">
              <div className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                {tRoot("objects.form.links")}
              </div>
              <div className="space-y-1">
                {collection.links?.map((link) => (
                  <a
                    key={link.url}
                    href={link.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex w-max items-center gap-2 text-sm text-muted-foreground transition-colors hover:text-accent hover:underline"
                  >
                    <LinkIcon className="size-3.5 text-muted-foreground" />
                    <span>{link.label || link.url}</span>
                  </a>
                ))}
              </div>
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
