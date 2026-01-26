"use client";

import { useOrganization } from "@/components/organization-provider";
import { api } from "@v1/backend/convex/_generated/api";
import type { Id } from "@v1/backend/convex/_generated/dataModel";
import { Button } from "@v1/ui/button";
import { Input } from "@v1/ui/input";
import { Label } from "@v1/ui/label";
import { Switch } from "@v1/ui/switch";
import { useMutation, useQuery } from "convex/react";
import { ExternalLink, Loader2, Save } from "lucide-react";
import { useEffect, useState } from "react";

export function PortalSettingsSidebar() {
  const { currentOrganizationId } = useOrganization();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);

  const [isEnabled, setIsEnabled] = useState(false);
  const [isSearchEnabled, setIsSearchEnabled] = useState(false);
  const [isHighResEnabled, setIsHighResEnabled] = useState(false);
  const [isValuationVisible, setIsValuationVisible] = useState(false);
  const [portalSlug, setPortalSlug] = useState("gallery");

  const portalSettings = useQuery(
    api.organizations.getPortalSettings,
    currentOrganizationId
      ? { organizationId: currentOrganizationId as Id<"organizations"> }
      : "skip",
  );

  const updatePortalSettings = useMutation(
    api.organizations.updatePortalSettings,
  );

  useEffect(() => {
    if (portalSettings) {
      setIsEnabled(portalSettings.isEnabled);
      setIsSearchEnabled(portalSettings.isSearchEnabled);
      setIsHighResEnabled(portalSettings.isHighResEnabled);
      setIsValuationVisible(portalSettings.isValuationVisible);
      setPortalSlug(portalSettings.portalSlug);
    }
  }, [portalSettings]);

  const handleSave = async () => {
    if (!currentOrganizationId) return;

    setIsSubmitting(true);
    setShowSuccess(false);

    try {
      await updatePortalSettings({
        organizationId: currentOrganizationId as Id<"organizations">,
        portalSettings: {
          isEnabled,
          isSearchEnabled,
          isHighResEnabled,
          isValuationVisible,
          portalSlug: portalSlug.toLowerCase().replace(/[^a-z0-9-]/g, "-"),
        },
      });
      setShowSuccess(true);
      setTimeout(() => setShowSuccess(false), 3000);
    } catch (error) {
      console.error("Failed to update portal settings:", error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const webUrl = process.env.NEXT_PUBLIC_WEB_URL || "https://museumlite.com";
  const fullPortalUrl = portalSettings?.orgSlug
    ? `${webUrl}/${portalSettings.orgSlug}/${portalSlug}`
    : "";

  if (portalSettings === undefined) {
    return (
      <div className="w-80 flex-shrink-0">
        <div className="rounded-lg border border-border bg-card p-6">
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="w-80 flex-shrink-0">
      <div className="rounded-lg border border-border bg-card p-6 space-y-6">
        <div>
          <h3 className="text-lg font-medium mb-1">Portal Settings</h3>
          <p className="text-sm text-muted-foreground">
            Configure your public collection portal
          </p>
        </div>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="portal-slug" className="text-sm font-medium">
              Portal URL Slug
            </Label>
            <div className="flex items-center gap-1 text-sm text-muted-foreground mb-2">
              <span className="truncate">
                {webUrl}/{portalSettings.orgSlug}/
              </span>
            </div>
            <Input
              id="portal-slug"
              value={portalSlug}
              onChange={(e) => setPortalSlug(e.target.value)}
              placeholder="gallery"
              className="font-mono text-sm"
            />
          </div>

          <div className="space-y-1">
            <Label className="text-sm font-medium">Full Portal URL</Label>
            <div className="flex items-center gap-2">
              <div className="flex-1 px-3 py-2 rounded-md bg-secondary/50 border border-border text-sm text-muted-foreground truncate font-mono">
                {fullPortalUrl || "Not configured"}
              </div>
              {fullPortalUrl && isEnabled && (
                <a
                  href={fullPortalUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="p-2 rounded-md hover:bg-secondary transition-colors"
                >
                  <ExternalLink className="h-4 w-4 text-muted-foreground" />
                </a>
              )}
            </div>
          </div>
        </div>

        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="portal-enabled" className="text-sm font-medium">
                Portal Enabled
              </Label>
              <p className="text-xs text-muted-foreground">
                Make your collection publicly accessible
              </p>
            </div>
            <Switch
              id="portal-enabled"
              checked={isEnabled}
              onCheckedChange={setIsEnabled}
            />
          </div>

          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="search-enabled" className="text-sm font-medium">
                Public Search
              </Label>
              <p className="text-xs text-muted-foreground">
                Allow visitors to search your collection
              </p>
            </div>
            <Switch
              id="search-enabled"
              checked={isSearchEnabled}
              onCheckedChange={setIsSearchEnabled}
              disabled={!isEnabled}
            />
          </div>

          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="highres-enabled" className="text-sm font-medium">
                High-Res Downloads
              </Label>
              <p className="text-xs text-muted-foreground">
                Allow downloading high-resolution images
              </p>
            </div>
            <Switch
              id="highres-enabled"
              checked={isHighResEnabled}
              onCheckedChange={setIsHighResEnabled}
              disabled={!isEnabled}
            />
          </div>

          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label
                htmlFor="valuations-visible"
                className="text-sm font-medium"
              >
                Show Valuations
              </Label>
              <p className="text-xs text-muted-foreground">
                Display valuation information publicly
              </p>
            </div>
            <Switch
              id="valuations-visible"
              checked={isValuationVisible}
              onCheckedChange={setIsValuationVisible}
              disabled={!isEnabled}
            />
          </div>
        </div>

        <div className="pt-2">
          <Button
            onClick={handleSave}
            disabled={isSubmitting}
            className="w-full"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Saving...
              </>
            ) : showSuccess ? (
              <>
                <Save className="mr-2 h-4 w-4" />
                Saved!
              </>
            ) : (
              <>
                <Save className="mr-2 h-4 w-4" />
                Save Settings
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
