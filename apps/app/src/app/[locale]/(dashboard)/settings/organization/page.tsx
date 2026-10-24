"use client";

import { api } from "@v1/backend/convex/_generated/api";
import type { Doc, Id } from "@v1/backend/convex/_generated/dataModel";
import {
  MAX_ADDRESS_LINE_LENGTH,
  MAX_PHONE_LENGTH,
  ORGANIZATION_ADDRESS_LINES,
  type OrganizationAddress,
  type OrganizationAddressLine,
} from "@v1/backend/convex/utils/organizationContact";
import { Button } from "@v1/ui/button";
import { Input } from "@v1/ui/input";
import { Label } from "@v1/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@v1/ui/select";
import { cn } from "@v1/ui/utils";
import { useMutation, useQuery } from "convex/react";
import { Droplet, Plus, Save } from "lucide-react";
import Link from "next/link";
import { type FormEvent, useReducer, useState } from "react";
import { ConfirmedSwitchRow } from "@/components/confirmed-switch";
import { useOrganization } from "@/components/organization-provider";
import { PermissionGate, usePermissions } from "@/components/permission-gate";
import {
  CONTACT_FIELD_LABELS,
  useOrganizationContactErrorMessage,
} from "@/hooks/use-organization-contact-error-message";
import { useScopedI18n } from "@/locales/client";
import { OrganizationDeletionZone } from "./organization-deletion-zone";

type WatermarkPosition =
  | "center"
  | "top-left"
  | "top-right"
  | "bottom-left"
  | "bottom-right";

interface WatermarkSettings {
  isEnabled: boolean;
  text: string;
  opacity: number;
  position: WatermarkPosition;
}

type ContactField = OrganizationAddressLine | "phone";
type ContactDetails = Record<ContactField, string>;

const CONTACT_FIELDS: ContactField[] = [...ORGANIZATION_ADDRESS_LINES, "phone"];

/** Street lines take a full row; the other fields pair up. */
const FULL_ROW_FIELDS = new Set<ContactField>(["street", "street2"]);

function contactDetailsOf(organization: {
  address?: OrganizationAddress;
  phone?: string;
}): ContactDetails {
  const address = organization.address ?? {};
  return {
    street: address.street ?? "",
    street2: address.street2 ?? "",
    postalCode: address.postalCode ?? "",
    city: address.city ?? "",
    region: address.region ?? "",
    country: address.country ?? "",
    phone: organization.phone ?? "",
  };
}

function watermarkSettingsOf(
  organization: Pick<Doc<"organizations">, "settings">,
): WatermarkSettings {
  const watermark = organization.settings?.watermarkSettings;
  return {
    isEnabled: watermark?.isEnabled ?? false,
    text: watermark?.text || "",
    opacity: watermark?.opacity ?? 0.5,
    position: watermark?.position || "bottom-right",
  };
}

/**
 * What the user changed and has not saved yet. The form shows the stored
 * Organization with these on top, so a change made elsewhere shows up in the
 * fields left alone, and a save sends only what was edited.
 */
interface OrganizationFormEdits {
  name: string | null;
  contactDetails: Partial<ContactDetails>;
  watermarkSettings: Partial<WatermarkSettings>;
}

const NO_EDITS: OrganizationFormEdits = {
  name: null,
  contactDetails: {},
  watermarkSettings: {},
};

type OrganizationFormAction =
  | { type: "editName"; value: string }
  | { type: "editContactDetail"; field: ContactField; value: string }
  | { type: "editWatermarkSettings"; value: Partial<WatermarkSettings> }
  | { type: "detailsSaved"; saved: OrganizationFormEdits }
  | { type: "watermarkSaved"; saved: OrganizationFormEdits };

function organizationFormReducer(
  state: OrganizationFormEdits,
  action: OrganizationFormAction,
): OrganizationFormEdits {
  switch (action.type) {
    case "editName":
      return { ...state, name: action.value };
    case "editContactDetail":
      return {
        ...state,
        contactDetails: {
          ...state.contactDetails,
          [action.field]: action.value,
        },
      };
    case "editWatermarkSettings":
      return {
        ...state,
        watermarkSettings: { ...state.watermarkSettings, ...action.value },
      };
    // A save clears the edits it sent; any edit made while it ran stays.
    case "detailsSaved":
      return {
        ...state,
        name: state.name === action.saved.name ? null : state.name,
        contactDetails:
          state.contactDetails === action.saved.contactDetails
            ? {}
            : state.contactDetails,
      };
    case "watermarkSaved":
      return {
        ...state,
        watermarkSettings:
          state.watermarkSettings === action.saved.watermarkSettings
            ? {}
            : state.watermarkSettings,
      };
  }
}

function OrganizationSettingsHeader({
  addOrganizationLabel,
  description,
  title,
}: {
  addOrganizationLabel: string;
  description: string;
  title: string;
}) {
  return (
    <div className="flex w-full flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
      <div className="flex flex-col gap-2">
        <h2 className="text-xl font-medium text-foreground">{title}</h2>
        <p className="text-sm text-muted-foreground">{description}</p>
      </div>
      <Button asChild>
        <Link href="/settings/organization/new">
          <Plus className="mr-2 size-4" />
          {addOrganizationLabel}
        </Link>
      </Button>
    </div>
  );
}

function OrganizationMessageCard({ message }: { message: string }) {
  return (
    <div className="flex min-h-48 items-center justify-center rounded-lg border border-border bg-card p-6">
      <p className="text-muted-foreground">{message}</p>
    </div>
  );
}

function OrganizationSettingsError({ error }: { error: string | null }) {
  if (!error) {
    return null;
  }

  return (
    <div className="rounded-lg border border-destructive bg-destructive/10 p-3 text-sm text-destructive">
      {error}
    </div>
  );
}

function BasicInformationCard({
  labels,
  name,
  onNameChange,
  organization,
  customerNumber,
}: {
  labels: {
    accountNumberCannotChange: string;
    accountNumberLabel: string;
    basicInformation: string;
    nameLabel: string;
    slugCannotChange: string;
    slugLabel: string;
    typeCannotChange: string;
    typeLabel: string;
  };
  name: string;
  onNameChange: (name: string) => void;
  organization: {
    slug: string;
    type: string;
  };
  customerNumber: string | null;
}) {
  return (
    <div className="rounded-lg border border-border bg-card p-6">
      <h2 className="mb-4 text-lg font-medium">{labels.basicInformation}</h2>
      <div className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="name">{labels.nameLabel}</Label>
          <PermissionGate
            permission="organization.manage_settings"
            fallback={<Input id="name" value={name} disabled />}
          >
            <Input
              id="name"
              value={name}
              onChange={(event) => onNameChange(event.target.value)}
              required
            />
          </PermissionGate>
        </div>
        {customerNumber ? (
          <div className="space-y-2">
            <Label htmlFor="account-number">{labels.accountNumberLabel}</Label>
            <Input
              id="account-number"
              readOnly
              value={customerNumber}
              className="bg-muted font-mono"
            />
            <p className="text-xs text-muted-foreground">
              {labels.accountNumberCannotChange}
            </p>
          </div>
        ) : null}
        <div className="space-y-2">
          <Label>{labels.typeLabel}</Label>
          <Input value={organization.type} disabled className="bg-muted" />
          <p className="text-xs text-muted-foreground">
            {labels.typeCannotChange}
          </p>
        </div>
        <div className="space-y-2">
          <Label>{labels.slugLabel}</Label>
          <Input value={organization.slug} disabled className="bg-muted" />
          <p className="text-xs text-muted-foreground">
            {labels.slugCannotChange}
          </p>
        </div>
      </div>
    </div>
  );
}

function ContactDetailsCard({
  details,
  disabled,
  onDetailChange,
}: {
  details: ContactDetails;
  disabled: boolean;
  onDetailChange: (field: ContactField, value: string) => void;
}) {
  const t = useScopedI18n("settings.organization");
  return (
    <div className="rounded-lg border border-border bg-card p-6">
      <h2 className="mb-4 text-lg font-medium">{t("addressAndPhone")}</h2>
      <div className="grid gap-4 sm:grid-cols-2">
        {CONTACT_FIELDS.map((name) => {
          const id = `organization-${name}`;
          const isPhone = name === "phone";
          return (
            <div
              key={name}
              className={cn(
                "space-y-2",
                FULL_ROW_FIELDS.has(name) && "sm:col-span-2",
              )}
            >
              <Label htmlFor={id}>{t(CONTACT_FIELD_LABELS[name])}</Label>
              <Input
                id={id}
                type={isPhone ? "tel" : "text"}
                maxLength={isPhone ? MAX_PHONE_LENGTH : MAX_ADDRESS_LINE_LENGTH}
                value={details[name]}
                disabled={disabled}
                onChange={(event) => onDetailChange(name, event.target.value)}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
}

function WatermarkPreview({ settings }: { settings: WatermarkSettings }) {
  const t = useScopedI18n("untranslatedDashboard.settings");
  return (
    <div className="rounded-lg border bg-muted/20 p-4">
      <p className="mb-2 text-xs font-medium text-muted-foreground">
        {t("preview")}
      </p>
      <div className="relative h-32 overflow-hidden rounded border bg-gradient-to-br from-zinc-100 to-zinc-200 dark:from-zinc-800 dark:to-zinc-900">
        {settings.text ? (
          <div
            className={cn("absolute text-sm font-medium text-foreground", {
              "left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2":
                settings.position === "center",
              "left-4 top-4": settings.position === "top-left",
              "right-4 top-4": settings.position === "top-right",
              "bottom-4 left-4": settings.position === "bottom-left",
              "bottom-4 right-4": settings.position === "bottom-right",
            })}
            style={{ opacity: settings.opacity }}
          >
            {settings.text}
          </div>
        ) : null}
      </div>
    </div>
  );
}

function WatermarkSettingsCard({
  isSubmitting,
  onSave,
  onSettingsChange,
  settings,
}: {
  isSubmitting: boolean;
  onSave: () => void;
  onSettingsChange: (change: Partial<WatermarkSettings>) => void;
  settings: WatermarkSettings;
}) {
  const t = useScopedI18n("untranslatedDashboard.settings");
  return (
    <div className="rounded-lg border border-border bg-card p-6">
      <div className="mb-4 flex items-center gap-2">
        <Droplet className="size-5" />
        <h2 className="text-lg font-medium">{t("watermarkSettings")}</h2>
      </div>
      <div className="space-y-4">
        <ConfirmedSwitchRow
          label={t("enableWatermark")}
          description={t("applyWatermarkEditedImages")}
          descriptionClassName="text-xs"
          checked={settings.isEnabled}
          appliesOnSave
          onConfirmedChange={(checked) =>
            onSettingsChange({
              isEnabled: checked,
            })
          }
        />

        {settings.isEnabled ? (
          <>
            <div className="space-y-2">
              <Label htmlFor="watermarkText">{t("watermarkText")}</Label>
              <Input
                id="watermarkText"
                value={settings.text}
                onChange={(event) =>
                  onSettingsChange({
                    text: event.target.value,
                  })
                }
                placeholder={t("watermarkPlaceholder")}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="watermarkPosition">{t("position")}</Label>
              <Select
                value={settings.position}
                onValueChange={(value) =>
                  onSettingsChange({
                    position: value as WatermarkPosition,
                  })
                }
              >
                <SelectTrigger id="watermarkPosition">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="center">{t("center")}</SelectItem>
                  <SelectItem value="top-left">{t("topLeft")}</SelectItem>
                  <SelectItem value="top-right">{t("topRight")}</SelectItem>
                  <SelectItem value="bottom-left">{t("bottomLeft")}</SelectItem>
                  <SelectItem value="bottom-right">
                    {t("bottomRight")}
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="watermarkOpacity">{t("opacity")}</Label>
                <span className="text-sm text-muted-foreground">
                  {Math.round(settings.opacity * 100)}%
                </span>
              </div>
              <input
                type="range"
                id="watermarkOpacity"
                min={0}
                max={1}
                step={0.05}
                value={settings.opacity}
                onChange={(event) =>
                  onSettingsChange({
                    opacity: Number.parseFloat(event.target.value),
                  })
                }
                className="w-full accent-primary"
              />
            </div>

            <WatermarkPreview settings={settings} />

            <div className="flex justify-end">
              <Button
                type="button"
                onClick={onSave}
                disabled={isSubmitting || !settings.text.trim()}
              >
                <Save className="mr-2 size-4" />
                {t("saveWatermarkSettings")}
              </Button>
            </div>
          </>
        ) : null}
      </div>
    </div>
  );
}

function OrganizationSaveActions({
  isSubmitting,
  labels,
}: {
  isSubmitting: boolean;
  labels: {
    saveChanges: string;
    saving: string;
  };
}) {
  return (
    <div className="flex justify-end gap-4">
      <Button type="submit" disabled={isSubmitting}>
        <Save className="mr-2 size-4" />
        {isSubmitting ? labels.saving : labels.saveChanges}
      </Button>
    </div>
  );
}

export default function OrganizationSettingsPage() {
  const t = useScopedI18n("settings");
  const tDashboard = useScopedI18n("untranslatedDashboard.settings");
  const tCommon = useScopedI18n("common");
  const { currentOrganizationId } = useOrganization();

  const organization = useQuery(
    api.organizations.get,
    currentOrganizationId
      ? { organizationId: currentOrganizationId as Id<"organizations"> }
      : "skip",
  );

  const pageHeader = (
    <OrganizationSettingsHeader
      addOrganizationLabel={t("organization.addOrganization")}
      description={t("organization.description")}
      title={t("organization.title")}
    />
  );

  if (!currentOrganizationId) {
    return (
      <div className="flex w-full flex-col gap-6">
        {pageHeader}
        <OrganizationMessageCard
          message={tDashboard("organizationSettingsRequired")}
        />
      </div>
    );
  }

  if (organization === undefined) {
    return (
      <div className="flex w-full flex-col gap-6">
        {pageHeader}
        <OrganizationMessageCard message={tCommon("loading")} />
      </div>
    );
  }

  if (organization === null) {
    return (
      <div className="flex w-full flex-col gap-6">
        {pageHeader}
        <OrganizationMessageCard message={tCommon("noResults")} />
      </div>
    );
  }

  return (
    <div className="flex w-full flex-col gap-6">
      {pageHeader}
      {/* Keyed so a switch of Organization starts a fresh form. */}
      <OrganizationSettingsForm
        key={organization._id}
        organization={organization}
      />
    </div>
  );
}

function OrganizationSettingsForm({
  organization,
}: {
  organization: Doc<"organizations">;
}) {
  const t = useScopedI18n("settings");
  const tDashboard = useScopedI18n("untranslatedDashboard.settings");
  const { hasPermission } = usePermissions();
  const contactErrorMessage = useOrganizationContactErrorMessage();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [edits, dispatch] = useReducer(organizationFormReducer, NO_EDITS);
  const updateOrganization = useMutation(api.organizations.update);
  const updateWatermarkSettings = useMutation(
    api.organizations.updateWatermarkSettings,
  );

  const name = edits.name ?? organization.name;
  const contactDetails = {
    ...contactDetailsOf(organization),
    ...edits.contactDetails,
  };
  const watermarkSettings = {
    ...watermarkSettingsOf(organization),
    ...edits.watermarkSettings,
  };

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);

    if (!name.trim()) {
      setError(t("organization.organizationNameRequired"));
      return;
    }

    const { phone: phoneEdit, ...addressEdits } = edits.contactDetails;
    const { phone, ...address } = contactDetails;
    const changes = {
      ...(edits.name !== null && { name: name.trim() }),
      ...(Object.keys(addressEdits).length > 0 && { address }),
      ...(phoneEdit !== undefined && { phone }),
    };
    if (Object.keys(changes).length === 0) {
      return;
    }

    setIsSubmitting(true);
    try {
      await updateOrganization({
        organizationId: organization._id,
        ...changes,
      });
      dispatch({ type: "detailsSaved", saved: edits });
    } catch (saveError) {
      setError(contactErrorMessage(saveError) ?? t("organization.updateError"));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSaveWatermarkSettings = async () => {
    setIsSubmitting(true);
    setError(null);

    try {
      await updateWatermarkSettings({
        organizationId: organization._id,
        watermarkSettings: {
          isEnabled: watermarkSettings.isEnabled,
          text: watermarkSettings.text.trim() || undefined,
          opacity: watermarkSettings.opacity,
          position: watermarkSettings.position,
        },
      });
      dispatch({ type: "watermarkSaved", saved: edits });
    } catch {
      setError(tDashboard("failedToUpdateWatermarkSettings"));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <OrganizationSettingsError error={error} />

      <BasicInformationCard
        labels={{
          accountNumberCannotChange: t(
            "organization.accountNumberCannotChange",
          ),
          accountNumberLabel: t("organization.accountNumberLabel"),
          basicInformation: t("organization.basicInformation"),
          nameLabel: t("organization.nameLabel"),
          slugCannotChange: t("organization.slugCannotChange"),
          slugLabel: t("organization.slugLabel"),
          typeCannotChange: t("organization.typeCannotChange"),
          typeLabel: t("organization.typeLabel"),
        }}
        name={name}
        onNameChange={(value) => dispatch({ type: "editName", value })}
        organization={organization}
        customerNumber={organization.customerNumber ?? null}
      />

      <ContactDetailsCard
        details={contactDetails}
        disabled={!hasPermission("organization.manage_settings")}
        onDetailChange={(field, value) =>
          dispatch({ type: "editContactDetail", field, value })
        }
      />

      <PermissionGate permission="organization.manage_settings">
        <WatermarkSettingsCard
          isSubmitting={isSubmitting}
          onSave={handleSaveWatermarkSettings}
          onSettingsChange={(value) =>
            dispatch({ type: "editWatermarkSettings", value })
          }
          settings={watermarkSettings}
        />

        <OrganizationSaveActions
          isSubmitting={isSubmitting}
          labels={{
            saveChanges: t("organization.saveChanges"),
            saving: t("organization.saving"),
          }}
        />

        <OrganizationDeletionZone
          organizationId={organization._id}
          isSubOrganization={Boolean(organization.parentOrganizationId)}
        />
      </PermissionGate>
    </form>
  );
}
