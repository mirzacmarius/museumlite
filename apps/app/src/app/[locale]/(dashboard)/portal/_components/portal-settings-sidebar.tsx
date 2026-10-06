"use client";

import { api } from "@v1/backend/convex/_generated/api";
import type { Id } from "@v1/backend/convex/_generated/dataModel";
import { Button } from "@v1/ui/button";
import { Input } from "@v1/ui/input";
import { Label } from "@v1/ui/label";
import { Switch } from "@v1/ui/switch";
import { useMutation, useQuery } from "convex/react";
import { ExternalLink, Loader2, Save } from "lucide-react";
import { useEffect, useReducer } from "react";
import { useOrganization } from "@/components/organization-provider";
import { getPublicPortalBaseUrl } from "@/lib/portal-url";
import { useScopedI18n } from "@/locales/client";

interface PortalSettingsSidebarState {
  isSubmitting: boolean;
  showSuccess: boolean;
  isEnabled: boolean;
  isSearchEnabled: boolean;
  isHighResEnabled: boolean;
  isValuationVisible: boolean;
  portalSlug: string;
}

type PortalSettingsSidebarAction =
  | { type: "setIsSubmitting"; value: boolean }
  | { type: "setShowSuccess"; value: boolean }
  | { type: "setIsEnabled"; value: boolean }
  | { type: "setIsSearchEnabled"; value: boolean }
  | { type: "setIsHighResEnabled"; value: boolean }
  | { type: "setIsValuationVisible"; value: boolean }
  | { type: "setPortalSlug"; value: string }
  | {
      type: "syncFromPortalSettings";
      settings: {
        isEnabled: boolean;
        isSearchEnabled: boolean;
        isHighResEnabled: boolean;
        isValuationVisible: boolean;
        portalSlug: string;
      };
    };

const initialPortalSettingsSidebarState: PortalSettingsSidebarState = {
  isSubmitting: false,
  showSuccess: false,
  isEnabled: false,
  isSearchEnabled: false,
  isHighResEnabled: false,
  isValuationVisible: false,
  portalSlug: "gallery",
};

function portalSettingsSidebarReducer(
  state: PortalSettingsSidebarState,
  action: PortalSettingsSidebarAction,
): PortalSettingsSidebarState {
  switch (action.type) {
    case "setIsSubmitting":
      return { ...state, isSubmitting: action.value };
    case "setShowSuccess":
      return { ...state, showSuccess: action.value };
    case "setIsEnabled":
      return { ...state, isEnabled: action.value };
    case "setIsSearchEnabled":
      return { ...state, isSearchEnabled: action.value };
    case "setIsHighResEnabled":
      return { ...state, isHighResEnabled: action.value };
    case "setIsValuationVisible":
      return { ...state, isValuationVisible: action.value };
    case "setPortalSlug":
      return { ...state, portalSlug: action.value };
    case "syncFromPortalSettings":
      return {
        ...state,
        isEnabled: action.settings.isEnabled,
        isSearchEnabled: action.settings.isSearchEnabled,
        isHighResEnabled: action.settings.isHighResEnabled,
        isValuationVisible: action.settings.isValuationVisible,
        portalSlug: action.settings.portalSlug,
      };
  }
}

export function PortalSettingsSidebar() {
  const t = useScopedI18n("untranslatedDashboard.portal");
  const { currentOrganizationId } = useOrganization();
  const [state, dispatch] = useReducer(
    portalSettingsSidebarReducer,
    initialPortalSettingsSidebarState,
  );

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
      dispatch({
        type: "syncFromPortalSettings",
        settings: {
          isEnabled: portalSettings.isEnabled,
          isSearchEnabled: portalSettings.isSearchEnabled,
          isHighResEnabled: portalSettings.isHighResEnabled,
          isValuationVisible: portalSettings.isValuationVisible,
          portalSlug: portalSettings.portalSlug,
        },
      });
    }
  }, [portalSettings]);

  const handleSave = async () => {
    if (!currentOrganizationId) return;

    dispatch({ type: "setIsSubmitting", value: true });
    dispatch({ type: "setShowSuccess", value: false });

    try {
      await updatePortalSettings({
        organizationId: currentOrganizationId as Id<"organizations">,
        portalSettings: {
          isEnabled: state.isEnabled,
          isSearchEnabled: state.isSearchEnabled,
          isHighResEnabled: state.isHighResEnabled,
          isValuationVisible: state.isValuationVisible,
          portalSlug: state.portalSlug
            .toLowerCase()
            .replace(/[^a-z0-9-]/g, "-"),
        },
      });
      dispatch({ type: "setShowSuccess", value: true });
      setTimeout(
        () => dispatch({ type: "setShowSuccess", value: false }),
        3000,
      );
    } catch (error) {
      console.error("Failed to update portal settings:", error);
    } finally {
      dispatch({ type: "setIsSubmitting", value: false });
    }
  };

  const webUrl = getPublicPortalBaseUrl();
  const fullPortalUrl = portalSettings?.orgSlug
    ? `${webUrl}/${portalSettings.orgSlug}/${state.portalSlug}`
    : "";

  if (portalSettings === undefined) {
    return (
      <div className="w-0 flex-shrink-0">
        <div className="rounded-lg border border-border bg-card p-6">
          <div className="flex items-center justify-center py-8">
            <Loader2 className="size-6 animate-spin text-muted-foreground" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="w-80 flex-shrink-0">
      <div className="space-y-5 rounded-lg border border-border bg-card p-5">
        <div>
          <h3 className="section-title mb-1">{t("portalSettings")}</h3>
          <p className="caption text-muted-foreground">
            {t("configurePortal")}
          </p>
        </div>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="portal-slug" className="field-label">
              {t("portalUrlSlug")}
            </Label>
            <div className="caption mb-2 flex items-center gap-1 text-muted-foreground">
              <span className="truncate">
                {webUrl}/{portalSettings.orgSlug}/
              </span>
            </div>
            <Input
              id="portal-slug"
              value={state.portalSlug}
              onChange={(e) =>
                dispatch({ type: "setPortalSlug", value: e.target.value })
              }
              placeholder={t("galleryPlaceholder")}
              className="code-text"
            />
          </div>

          <div className="space-y-1">
            <Label className="field-label">{t("fullPortalUrl")}</Label>
            <div className="flex items-center gap-2">
              <div className="code-text flex-1 truncate rounded-md border border-border bg-secondary/50 px-3 py-2 text-muted-foreground">
                {fullPortalUrl || t("notConfigured")}
              </div>
              {fullPortalUrl && state.isEnabled && (
                <a
                  href={fullPortalUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="rounded-md p-2 transition-colors hover:bg-secondary"
                >
                  <ExternalLink className="size-4 text-muted-foreground" />
                </a>
              )}
            </div>
          </div>
        </div>

        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="portal-enabled" className="field-label">
                {t("portalEnabled")}
              </Label>
              <p className="caption text-muted-foreground">
                {t("publiclyAccessible")}
              </p>
            </div>
            <Switch
              id="portal-enabled"
              checked={state.isEnabled}
              onCheckedChange={(value) =>
                dispatch({ type: "setIsEnabled", value })
              }
            />
          </div>

          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="search-enabled" className="field-label">
                {t("publicSearch")}
              </Label>
              <p className="caption text-muted-foreground">
                {t("allowVisitorsToSearch")}
              </p>
            </div>
            <Switch
              id="search-enabled"
              checked={state.isSearchEnabled}
              onCheckedChange={(value) =>
                dispatch({ type: "setIsSearchEnabled", value })
              }
              disabled={!state.isEnabled}
            />
          </div>

          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="highres-enabled" className="field-label">
                {t("highResDownloads")}
              </Label>
              <p className="caption text-muted-foreground">
                {t("allowHighResDownloads")}
              </p>
            </div>
            <Switch
              id="highres-enabled"
              checked={state.isHighResEnabled}
              onCheckedChange={(value) =>
                dispatch({ type: "setIsHighResEnabled", value })
              }
              disabled={!state.isEnabled}
            />
          </div>

          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="valuations-visible" className="field-label">
                {t("showValuations")}
              </Label>
              <p className="caption text-muted-foreground">
                {t("displayValuationsPublicly")}
              </p>
            </div>
            <Switch
              id="valuations-visible"
              checked={state.isValuationVisible}
              onCheckedChange={(value) =>
                dispatch({ type: "setIsValuationVisible", value })
              }
              disabled={!state.isEnabled}
            />
          </div>
        </div>

        <div className="pt-2">
          <Button
            onClick={handleSave}
            disabled={state.isSubmitting}
            className="w-full"
          >
            {state.isSubmitting ? (
              <>
                <Loader2 className="mr-2 size-4 animate-spin" />
                {t("saving")}
              </>
            ) : state.showSuccess ? (
              <>
                <Save className="mr-2 size-4" />
                {t("saved")}
              </>
            ) : (
              <>
                <Save className="mr-2 size-4" />
                {t("saveSettings")}
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
