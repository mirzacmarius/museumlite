"use client";

import { Link as LinkIcon } from "lucide-react";
import { ProvenanceClaimsPanel } from "@/components/provenance/provenance-claims-panel";
import { useI18n } from "@/locales/client";
import { DetailLabel } from "./detail-section";
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
        mode="view"
        objectId={collection._id}
        organizationId={collection.organizationId}
        legacyProvenance={collection.provenance}
        legacyOwnership={collection.ownershipHistory}
      />

      {collection.exhibitionHistory || hasLinks ? (
        <div className="grid grid-cols-1 gap-6 rounded-xl border border-border/60 bg-card p-4 sm:p-6 md:grid-cols-2">
          {collection.exhibitionHistory ? (
            <div className="grid content-start gap-2">
              <DetailLabel>
                {tRoot("objects.form.exhibitionHistory")}
              </DetailLabel>
              <p className="whitespace-pre-wrap text-sm leading-relaxed text-foreground">
                {collection.exhibitionHistory}
              </p>
            </div>
          ) : null}

          {hasLinks ? (
            <div className="grid content-start gap-2">
              <DetailLabel>{tRoot("objects.form.links")}</DetailLabel>
              <div className="space-y-1">
                {collection.links?.map((link) => (
                  <a
                    key={link.url}
                    href={link.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex w-max max-w-full items-center gap-2 text-sm text-muted-foreground transition-colors hover:text-accent-foreground hover:underline"
                  >
                    <LinkIcon className="size-3.5 text-muted-foreground" />
                    <span className="truncate">{link.label || link.url}</span>
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
