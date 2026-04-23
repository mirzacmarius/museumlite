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
    <div className="flex-1 flex flex-col min-h-0">
      <div className="flex items-center gap-2 px-4 py-3 bg-secondary/50 border border-white/10 rounded-t-lg">
        <div className="flex gap-1.5">
          <div className="w-3 h-3 rounded-full bg-red-500" />
          <div className="w-3 h-3 rounded-full bg-yellow-500" />
          <div className="w-3 h-3 rounded-full bg-green-500" />
        </div>
        <div className="flex-1 ml-4 px-3 py-1.5 bg-white/5 rounded text-sm text-white/60 truncate">
          {portalUrl}
        </div>
      </div>

      <div className="flex-1 border border-t-0 border-white/10 rounded-b-lg overflow-hidden bg-black min-h-[400px]">
        {isEnabled && orgSlug ? (
          <iframe
            src={portalUrl}
            className="w-full h-full border-0"
            title="Portal Preview"
          />
        ) : (
          <div className="flex flex-col items-center justify-center h-full text-center p-8">
            <Globe className="h-16 w-16 text-white/20 mb-4" />
            <p className="text-lg font-medium text-white/60 mb-2">
              Enable portal to preview
            </p>
            <p className="text-sm text-white/40 max-w-md">
              Toggle "Portal Enabled" in the settings to see a live preview of
              your public collection portal.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
