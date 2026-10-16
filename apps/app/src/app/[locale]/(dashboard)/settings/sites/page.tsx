"use client";

import { api } from "@v1/backend/convex/_generated/api";
import type { Id } from "@v1/backend/convex/_generated/dataModel";
import {
  type SiteInUseData,
  siteInUseFromError,
} from "@v1/backend/convex/utils/siteUsage";
import { Button } from "@v1/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@v1/ui/dialog";
import { EmptyState } from "@v1/ui/empty-state";
import { Input } from "@v1/ui/input";
import { Label } from "@v1/ui/label";
import { Textarea } from "@v1/ui/textarea";
import { useMutation, useQuery } from "convex/react";
import { Building2, Edit, MapPin, Plus, Trash2 } from "lucide-react";
import Link from "next/link";
import { type Dispatch, type FormEvent, useReducer } from "react";
import { CapabilityGuard } from "@/components/capability-guard";
import { ConfirmedSwitch } from "@/components/confirmed-switch";
import { useOrganization } from "@/components/organization-provider";
import { PermissionGate } from "@/components/permission-gate";
import { useCapabilities } from "@/hooks/use-capabilities";
import { useCapabilityErrorMessage } from "@/hooks/use-capability-error-message";
import { useI18n, useScopedI18n } from "@/locales/client";

interface SiteFormData {
  name: string;
  description: string;
  address: string;
  isPrimary: boolean;
}

interface EditingSite {
  _id: Id<"sites">;
  name: string;
  description?: string;
  address?: string;
  isPrimary: boolean;
  isActive: boolean;
}

interface SitesPageState {
  createDialogOpen: boolean;
  editDialogOpen: boolean;
  editingSite: EditingSite | null;
  formData: SiteFormData;
  isSubmitting: boolean;
  error: string | null;
  /** Why the last archive was refused, while its explanation is open. */
  siteInUse: SiteInUseData | null;
}

type SitesPageAction =
  | { type: "setCreateDialogOpen"; open: boolean }
  | { type: "setEditDialogOpen"; open: boolean }
  | { type: "setEditingSite"; site: EditingSite | null }
  | { type: "setFormData"; formData: SiteFormData }
  | { type: "patchFormData"; patch: Partial<SiteFormData> }
  | { type: "setIsSubmitting"; isSubmitting: boolean }
  | { type: "setError"; error: string | null }
  | { type: "setSiteInUse"; siteInUse: SiteInUseData | null }
  | { type: "resetForm" };

const EMPTY_SITE_FORM: SiteFormData = {
  name: "",
  description: "",
  address: "",
  isPrimary: false,
};

const INITIAL_SITES_PAGE_STATE: SitesPageState = {
  createDialogOpen: false,
  editDialogOpen: false,
  editingSite: null,
  formData: EMPTY_SITE_FORM,
  isSubmitting: false,
  error: null,
  siteInUse: null,
};

function sitesPageReducer(
  state: SitesPageState,
  action: SitesPageAction,
): SitesPageState {
  switch (action.type) {
    case "setCreateDialogOpen":
      return { ...state, createDialogOpen: action.open };
    case "setEditDialogOpen":
      return { ...state, editDialogOpen: action.open };
    case "setEditingSite":
      return { ...state, editingSite: action.site };
    case "setFormData":
      return { ...state, formData: action.formData };
    case "patchFormData":
      return { ...state, formData: { ...state.formData, ...action.patch } };
    case "setIsSubmitting":
      return { ...state, isSubmitting: action.isSubmitting };
    case "setError":
      return { ...state, error: action.error };
    case "setSiteInUse":
      return { ...state, siteInUse: action.siteInUse };
    case "resetForm":
      return { ...state, formData: EMPTY_SITE_FORM };
  }
}

function SitesPageHeader({
  createDialogOpen,
  dispatch,
  error,
  formData,
  isSubmitting,
  onCreateSite,
}: {
  createDialogOpen: boolean;
  dispatch: Dispatch<SitesPageAction>;
  error: string | null;
  formData: SiteFormData;
  isSubmitting: boolean;
  onCreateSite: (event: FormEvent) => void;
}) {
  const t = useScopedI18n("untranslatedDashboard.settings");
  return (
    <div className="flex w-full flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
      <div className="flex flex-col gap-2">
        <h2 className="text-xl font-medium text-foreground">
          {t("siteManagement")}
        </h2>
        <p className="text-sm text-muted-foreground">
          {t("physicalLocationsDescription")}
        </p>
      </div>
      <PermissionGate permission="sites.create">
        <Dialog
          open={createDialogOpen}
          onOpenChange={(open) =>
            dispatch({ type: "setCreateDialogOpen", open })
          }
        >
          <DialogTrigger asChild>
            <Button>
              <Plus className="mr-2 size-4" />
              {t("createSite")}
            </Button>
          </DialogTrigger>
          <SiteFormDialogContent
            error={error}
            formData={formData}
            isSubmitting={isSubmitting}
            mode="create"
            onCancel={() =>
              dispatch({ type: "setCreateDialogOpen", open: false })
            }
            onSubmit={onCreateSite}
            onUpdateForm={(patch) => dispatch({ type: "patchFormData", patch })}
          />
        </Dialog>
      </PermissionGate>
    </div>
  );
}

function SiteFormDialogContent({
  error,
  formData,
  isSubmitting,
  mode,
  onCancel,
  onSubmit,
  onUpdateForm,
}: {
  error: string | null;
  formData: SiteFormData;
  isSubmitting: boolean;
  mode: "create" | "edit";
  onCancel: () => void;
  onSubmit: (event: FormEvent) => void;
  onUpdateForm: (patch: Partial<SiteFormData>) => void;
}) {
  const tRoot = useI18n();
  const t = useScopedI18n("untranslatedDashboard.settings");
  const isCreate = mode === "create";
  const primarySiteId = isCreate ? "isPrimary" : "edit-isPrimary";

  return (
    <DialogContent>
      <form onSubmit={onSubmit}>
        <DialogHeader>
          <DialogTitle>
            {isCreate ? t("createNewSite") : t("editSite")}
          </DialogTitle>
          <DialogDescription>
            {isCreate ? t("createSiteDescription") : t("updateSiteDescription")}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {error ? (
            <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
              {error}
            </div>
          ) : null}

          <div className="space-y-2">
            <Label htmlFor={isCreate ? "name" : "edit-name"}>
              {t("siteNameRequired")}
            </Label>
            <Input
              id={isCreate ? "name" : "edit-name"}
              placeholder={t("siteNamePlaceholder")}
              value={formData.name}
              onChange={(event) => onUpdateForm({ name: event.target.value })}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor={isCreate ? "description" : "edit-description"}>
              {tRoot("untranslatedRecords.objects.attributes.description")}
            </Label>
            <Textarea
              id={isCreate ? "description" : "edit-description"}
              placeholder={t("descriptionPlaceholder")}
              value={formData.description}
              onChange={(event) =>
                onUpdateForm({ description: event.target.value })
              }
              rows={3}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor={isCreate ? "address" : "edit-address"}>
              {t("address")}
            </Label>
            <Textarea
              id={isCreate ? "address" : "edit-address"}
              placeholder={t("addressPlaceholder")}
              value={formData.address}
              onChange={(event) =>
                onUpdateForm({ address: event.target.value })
              }
              rows={2}
            />
          </div>

          <div className="flex items-center justify-between gap-x-2 rounded-lg border p-3">
            <div className="space-y-0.5">
              <p
                id={`${primarySiteId}-label`}
                className="text-sm leading-none font-medium"
              >
                {t("primarySite")}
              </p>
              <p
                id={`${primarySiteId}-description`}
                className="text-sm text-muted-foreground"
              >
                {t("setPrimarySite")}
              </p>
            </div>
            <ConfirmedSwitch
              id={primarySiteId}
              labelId={`${primarySiteId}-label`}
              descriptionId={`${primarySiteId}-description`}
              settingName={t("primarySite")}
              checked={formData.isPrimary}
              onConfirmedChange={(checked) =>
                onUpdateForm({ isPrimary: checked })
              }
            />
          </div>
        </div>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={onCancel}
            disabled={isSubmitting}
          >
            {t("cancel")}
          </Button>
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting
              ? isCreate
                ? t("creating")
                : t("updating")
              : isCreate
                ? t("createSite")
                : t("updateSite")}
          </Button>
        </DialogFooter>
      </form>
    </DialogContent>
  );
}

function SiteCard({
  onArchive,
  onEdit,
  site,
}: {
  onArchive: (siteId: Id<"sites">) => void;
  onEdit: (site: EditingSite) => void;
  site: EditingSite;
}) {
  const tRoot = useI18n();
  const t = useScopedI18n("untranslatedDashboard.settings");
  return (
    <div className="rounded-lg border bg-card p-4 shadow-sm transition-shadow hover:shadow-md">
      <div className="flex items-start justify-between">
        <div className="flex flex-1 items-start gap-3">
          <div className="rounded-full bg-primary/10 p-2">
            <Building2 className="size-4 text-primary" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <h3 className="truncate font-medium">{site.name}</h3>
              {site.isPrimary ? (
                <span className="inline-flex items-center rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
                  {t("primary")}
                </span>
              ) : null}
              {!site.isActive ? (
                <span className="inline-flex items-center rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
                  {t("archived")}
                </span>
              ) : null}
            </div>
            {site.description ? (
              <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">
                {site.description}
              </p>
            ) : null}
            {site.address ? (
              <div className="mt-2 flex items-start gap-1.5 text-sm text-muted-foreground">
                <MapPin className="mt-0.5 size-3.5 flex-shrink-0" />
                <span className="line-clamp-2">{site.address}</span>
              </div>
            ) : null}
          </div>
        </div>
      </div>

      <PermissionGate permission="sites.update">
        <div className="mt-4 flex items-center gap-2 border-t pt-4">
          <Button
            variant="outline"
            size="sm"
            onClick={() => onEdit(site)}
            className="flex-1"
          >
            <Edit className="mr-2 size-3.5" />
            {tRoot("untranslatedRecords.objects.actions.edit")}
          </Button>
          {!site.isPrimary && site.isActive ? (
            <PermissionGate permission="sites.delete">
              <Button
                variant="outline"
                size="sm"
                onClick={() => onArchive(site._id)}
                className="text-destructive hover:text-destructive"
              >
                <Trash2 className="size-3.5" />
              </Button>
            </PermissionGate>
          ) : null}
        </div>
      </PermissionGate>
    </div>
  );
}

/** Why a site cannot be archived yet, with the locations to resolve. */
function SiteInUseDialog({
  siteInUse,
  onClose,
}: {
  siteInUse: SiteInUseData;
  onClose: () => void;
}) {
  const t = useScopedI18n("untranslatedDashboard.settings");
  return (
    <Dialog open onOpenChange={(open) => (open ? undefined : onClose())}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("siteInUseTitle")}</DialogTitle>
          <DialogDescription>{t("siteInUseDescription")}</DialogDescription>
        </DialogHeader>
        <ul className="space-y-3 text-sm">
          {siteInUse.activeLocations > 0 ? (
            <li className="space-y-1">
              <p>
                {t("siteInUseLocations", {
                  count: siteInUse.activeLocations,
                })}
              </p>
              <ul className="list-disc space-y-1 pl-5">
                {siteInUse.locations.map((location) => (
                  <li key={location.id}>
                    <Link
                      href={`/locations/${location.id}`}
                      className="underline underline-offset-2"
                    >
                      {location.name}
                    </Link>
                  </li>
                ))}
              </ul>
            </li>
          ) : null}
          {siteInUse.objectsHeld > 0 ? (
            <li>{t("siteInUseObjects", { count: siteInUse.objectsHeld })}</li>
          ) : null}
          {siteInUse.incomplete ? <li>{t("siteInUseIncomplete")}</li> : null}
        </ul>
        <DialogFooter>
          <Button onClick={onClose}>{t("siteInUseClose")}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default function SitesSettingsPage() {
  const t = useScopedI18n("untranslatedDashboard.settings");
  const { currentOrganizationId } = useOrganization();
  const canUseSites = useCapabilities().isAvailable("sites");
  const capabilityErrorMessage = useCapabilityErrorMessage();
  const [state, dispatch] = useReducer(
    sitesPageReducer,
    INITIAL_SITES_PAGE_STATE,
  );
  const {
    createDialogOpen,
    editDialogOpen,
    editingSite,
    formData,
    isSubmitting,
    error,
    siteInUse,
  } = state;

  const sites = useQuery(
    api.sites.list,
    currentOrganizationId && canUseSites
      ? { organizationId: currentOrganizationId as Id<"organizations"> }
      : "skip",
  );

  const createSite = useMutation(api.sites.create);
  const updateSite = useMutation(api.sites.update);
  const archiveSite = useMutation(api.sites.archive);

  if (!currentOrganizationId) {
    return (
      <div className="flex size-full items-center justify-center">
        <p className="text-muted-foreground">{t("selectOrganizationSites")}</p>
      </div>
    );
  }

  const handleCreateSite = async (e: FormEvent) => {
    e.preventDefault();
    dispatch({ type: "setError", error: null });

    if (!formData.name.trim()) {
      dispatch({ type: "setError", error: t("siteNameRequired") });
      return;
    }

    dispatch({ type: "setIsSubmitting", isSubmitting: true });
    try {
      await createSite({
        organizationId: currentOrganizationId as Id<"organizations">,
        name: formData.name.trim(),
        description: formData.description.trim() || undefined,
        address: formData.address.trim() || undefined,
        isPrimary: formData.isPrimary,
      });
      dispatch({ type: "resetForm" });
      dispatch({ type: "setCreateDialogOpen", open: false });
    } catch (err) {
      console.error("Error creating site:", err);
      dispatch({
        type: "setError",
        error: capabilityErrorMessage(err) ?? t("failedCreateSite"),
      });
    } finally {
      dispatch({ type: "setIsSubmitting", isSubmitting: false });
    }
  };

  const handleEditSite = (site: EditingSite) => {
    dispatch({
      type: "setEditingSite",
      site: {
        _id: site._id,
        name: site.name,
        description: site.description,
        address: site.address,
        isPrimary: site.isPrimary,
        isActive: site.isActive,
      },
    });
    dispatch({
      type: "setFormData",
      formData: {
        name: site.name,
        description: site.description || "",
        address: site.address || "",
        isPrimary: site.isPrimary,
      },
    });
    dispatch({ type: "setEditDialogOpen", open: true });
  };

  const handleUpdateSite = async (e: FormEvent) => {
    e.preventDefault();
    if (!editingSite) return;

    dispatch({ type: "setError", error: null });

    if (!formData.name.trim()) {
      dispatch({ type: "setError", error: t("siteNameRequired") });
      return;
    }

    dispatch({ type: "setIsSubmitting", isSubmitting: true });
    try {
      await updateSite({
        siteId: editingSite._id,
        name: formData.name.trim(),
        description: formData.description.trim() || undefined,
        address: formData.address.trim() || undefined,
        isPrimary: formData.isPrimary,
      });
      dispatch({ type: "setEditingSite", site: null });
      dispatch({ type: "resetForm" });
      dispatch({ type: "setEditDialogOpen", open: false });
    } catch (err) {
      console.error("Error updating site:", err);
      dispatch({
        type: "setError",
        error: capabilityErrorMessage(err) ?? t("failedUpdateSite"),
      });
    } finally {
      dispatch({ type: "setIsSubmitting", isSubmitting: false });
    }
  };

  const handleArchiveSite = async (siteId: Id<"sites">) => {
    if (!confirm(t("archiveSiteConfirm"))) {
      return;
    }

    try {
      await archiveSite({ siteId });
    } catch (err) {
      const siteInUse = siteInUseFromError(err);
      if (siteInUse) {
        dispatch({ type: "setSiteInUse", siteInUse });
        return;
      }
      console.error("Error archiving site:", err);
      alert(capabilityErrorMessage(err) ?? t("failedArchiveSite"));
    }
  };

  return (
    <CapabilityGuard capability="sites" featureName={t("sites")}>
      <div className="flex flex-col gap-8">
        <SitesPageHeader
          createDialogOpen={createDialogOpen}
          dispatch={dispatch}
          error={error}
          formData={formData}
          isSubmitting={isSubmitting}
          onCreateSite={handleCreateSite}
        />

        <div className="space-y-4">
          <div>
            <h2 className="text-lg font-medium">{t("sites")}</h2>
            <p className="text-sm text-muted-foreground">
              {t("physicalLocationsDescription")}
            </p>
          </div>

          {!sites || sites.length === 0 ? (
            <EmptyState
              icon={Building2}
              title={t("noSites")}
              description={t("createFirstSite")}
            />
          ) : (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {sites.map((site) => (
                <SiteCard
                  key={site._id}
                  site={site}
                  onArchive={handleArchiveSite}
                  onEdit={handleEditSite}
                />
              ))}
            </div>
          )}
        </div>

        {siteInUse ? (
          <SiteInUseDialog
            siteInUse={siteInUse}
            onClose={() => dispatch({ type: "setSiteInUse", siteInUse: null })}
          />
        ) : null}

        <Dialog
          open={editDialogOpen}
          onOpenChange={(open) => dispatch({ type: "setEditDialogOpen", open })}
        >
          <SiteFormDialogContent
            error={error}
            formData={formData}
            isSubmitting={isSubmitting}
            mode="edit"
            onCancel={() => {
              dispatch({ type: "setEditDialogOpen", open: false });
              dispatch({ type: "setEditingSite", site: null });
            }}
            onSubmit={handleUpdateSite}
            onUpdateForm={(patch) => dispatch({ type: "patchFormData", patch })}
          />
        </Dialog>
      </div>
    </CapabilityGuard>
  );
}
