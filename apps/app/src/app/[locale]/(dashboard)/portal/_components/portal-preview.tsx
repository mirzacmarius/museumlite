"use client";

import { getPublicPortalBaseUrl } from "@/lib/portal-url";
import { Globe } from "lucide-react";

interface PortalPreviewProps {
  isEnabled: boolean;
  orgSlug: string;
  portalSlug: string;
}

export function PortalPreview({
  isEnabled,
  orgSlug,
  portalSlug,
}: PortalPreviewProps) {
  const webUrl = getPublicPortalBaseUrl();
  const portalUrl = `${webUrl}/${orgSlug}/${portalSlug}`;

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex items-center gap-2 rounded-t-lg border border-border bg-secondary/50 px-4 py-3">
        <div className="flex gap-1.5">
          <div className="size-3 rounded-full bg-red-500" />
          <div className="size-3 rounded-full bg-yellow-500" />
          <div className="size-3 rounded-full bg-green-500" />
        </div>
        <div className="code-text ml-4 flex-1 truncate rounded-md bg-background/60 px-3 py-1.5 text-muted-foreground">
          {portalUrl}
        </div>
      </div>

      <div className="min-h-[400px] flex-1 overflow-hidden rounded-b-lg border border-t-0 border-border bg-background">
        {isEnabled && orgSlug ? (
          <iframe
            src={portalUrl}
            className="size-full border-0"
            title="Portal Preview"
          />
        ) : (
          <div className="flex h-full flex-col items-center justify-center p-8 text-center">
            <Globe className="mb-4 size-12 text-muted-foreground/40" />
            <p className="section-title mb-2 text-muted-foreground">
              Enable portal to preview
            </p>
            <p className="caption max-w-md text-muted-foreground/70">
              Toggle "Portal Enabled" in the settings to see a live preview of
              your public collection portal.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
