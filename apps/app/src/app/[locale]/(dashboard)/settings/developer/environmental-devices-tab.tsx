"use client";

import { api } from "@v1/backend/convex/_generated/api";
import type { Id } from "@v1/backend/convex/_generated/dataModel";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@v1/ui/alert-dialog";
import { Button } from "@v1/ui/button";
import { Input } from "@v1/ui/input";
import { Label } from "@v1/ui/label";
import { useMutation, useQuery } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import {
  Check,
  Copy,
  Loader2,
  Plus,
  RotateCw,
  ShieldCheck,
  Thermometer,
} from "lucide-react";
import { type FormEvent, useReducer } from "react";
import { PermissionGate } from "@/components/permission-gate";
import { writeTextToClipboard } from "@/lib/clipboard";
import { useScopedI18n } from "@/locales/client";
import { ClientDateText } from "./developer-shared";

type EnvironmentalDevice = FunctionReturnType<
  typeof api.environmentalDevices.list
>[number];
type EnvironmentalLocation = FunctionReturnType<
  typeof api.environmentalDevices.listLocations
>[number];

interface ProbeFormState {
  probeId: string;
  locationId: string;
}

interface EnvironmentalDevicesState {
  name: string;
  probeForms: Record<string, ProbeFormState>;
  oneTimeCredential: string | null;
  error: string | null;
  isWorking: boolean;
  copied: boolean;
}

type EnvironmentalDevicesAction =
  | { type: "patch"; value: Partial<EnvironmentalDevicesState> }
  | {
      type: "updateProbeForm";
      deviceId: Id<"environmentalDevices">;
      defaultLocationId: string;
      update: Partial<ProbeFormState>;
    };

const initialState: EnvironmentalDevicesState = {
  name: "",
  probeForms: {},
  oneTimeCredential: null,
  error: null,
  isWorking: false,
  copied: false,
};

function environmentalDevicesReducer(
  state: EnvironmentalDevicesState,
  action: EnvironmentalDevicesAction,
): EnvironmentalDevicesState {
  if (action.type === "patch") return { ...state, ...action.value };

  const currentForm = state.probeForms[action.deviceId] ?? {
    probeId: "",
    locationId: action.defaultLocationId,
  };
  return {
    ...state,
    probeForms: {
      ...state.probeForms,
      [action.deviceId]: { ...currentForm, ...action.update },
    },
  };
}

export function EnvironmentalDevicesTab({
  organizationId,
}: {
  organizationId: Id<"organizations">;
}) {
  return (
    <PermissionGate permission="organization.manage_settings">
      <EnvironmentalDevicesContent organizationId={organizationId} />
    </PermissionGate>
  );
}

function EnvironmentalDevicesContent({
  organizationId,
}: {
  organizationId: Id<"organizations">;
}) {
  const t = useScopedI18n("settings.developer.environmentalDevices");
  const devices = useQuery(api.environmentalDevices.list, { organizationId });
  const locations = useQuery(api.environmentalDevices.listLocations, {
    organizationId,
  });
  const registerDevice = useMutation(api.environmentalDevices.register);
  const bindProbe = useMutation(api.environmentalDevices.bindProbe);
  const rotateDevice = useMutation(api.environmentalDevices.rotate);
  const revokeDevice = useMutation(api.environmentalDevices.revoke);
  const [state, dispatch] = useReducer(
    environmentalDevicesReducer,
    initialState,
  );
  const patchState = (value: Partial<EnvironmentalDevicesState>) =>
    dispatch({ type: "patch", value });

  const updateProbeForm = (
    deviceId: Id<"environmentalDevices">,
    update: Partial<ProbeFormState>,
  ) =>
    dispatch({
      type: "updateProbeForm",
      deviceId,
      defaultLocationId: locations?.[0]?._id ?? "",
      update,
    });

  const handleRegister = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!state.name.trim()) return;
    patchState({ error: null, isWorking: true });
    try {
      const result = await registerDevice({
        organizationId,
        name: state.name.trim(),
      });
      patchState({ oneTimeCredential: result.token, name: "" });
    } catch (cause) {
      patchState({
        error: cause instanceof Error ? cause.message : t("errors.register"),
      });
    } finally {
      patchState({ isWorking: false });
    }
  };

  const handleBind = async (
    deviceId: Id<"environmentalDevices">,
    event: FormEvent<HTMLFormElement>,
  ) => {
    event.preventDefault();
    const form = state.probeForms[deviceId];
    if (!form?.probeId.trim() || !form.locationId) return;
    patchState({ error: null, isWorking: true });
    try {
      await bindProbe({
        organizationId,
        deviceId,
        probeId: form.probeId.trim(),
        locationId: form.locationId as Id<"locations">,
      });
      updateProbeForm(deviceId, { probeId: "" });
    } catch (cause) {
      patchState({
        error: cause instanceof Error ? cause.message : t("errors.bind"),
      });
    } finally {
      patchState({ isWorking: false });
    }
  };

  const handleRotate = async (deviceId: Id<"environmentalDevices">) => {
    patchState({ error: null, isWorking: true });
    try {
      const result = await rotateDevice({ organizationId, deviceId });
      patchState({ oneTimeCredential: result.token });
    } catch (cause) {
      patchState({
        error: cause instanceof Error ? cause.message : t("errors.rotate"),
      });
    } finally {
      patchState({ isWorking: false });
    }
  };

  const handleRevoke = async (deviceId: Id<"environmentalDevices">) => {
    patchState({ error: null, isWorking: true });
    try {
      await revokeDevice({ organizationId, deviceId });
    } catch (cause) {
      patchState({
        error: cause instanceof Error ? cause.message : t("errors.revoke"),
      });
    } finally {
      patchState({ isWorking: false });
    }
  };

  const copyCredential = async () => {
    if (
      state.oneTimeCredential &&
      (await writeTextToClipboard(state.oneTimeCredential))
    ) {
      patchState({ copied: true });
      setTimeout(() => patchState({ copied: false }), 2000);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold">{t("title")}</h2>
        <p className="mt-1 text-sm text-muted-foreground">{t("description")}</p>
      </div>

      <DeviceRegistrationForm
        name={state.name}
        isWorking={state.isWorking}
        onNameChange={(name) => patchState({ name })}
        onSubmit={handleRegister}
      />
      {state.oneTimeCredential && (
        <OneTimeCredentialPanel
          credential={state.oneTimeCredential}
          copied={state.copied}
          onCopy={copyCredential}
          onDismiss={() => patchState({ oneTimeCredential: null })}
        />
      )}
      {state.error && (
        <p role="alert" className="text-sm text-destructive">
          {state.error}
        </p>
      )}
      <EnvironmentalDeviceList
        devices={devices}
        locations={locations ?? []}
        probeForms={state.probeForms}
        isWorking={state.isWorking}
        onProbeFormChange={updateProbeForm}
        onBind={handleBind}
        onRotate={handleRotate}
        onRevoke={handleRevoke}
      />
    </div>
  );
}

function DeviceRegistrationForm({
  name,
  isWorking,
  onNameChange,
  onSubmit,
}: {
  name: string;
  isWorking: boolean;
  onNameChange: (name: string) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
}) {
  const t = useScopedI18n("settings.developer.environmentalDevices");
  return (
    <form
      onSubmit={onSubmit}
      className="flex flex-wrap items-end gap-3 rounded-lg border border-border p-4"
    >
      <div className="min-w-56 flex-1 space-y-2">
        <Label htmlFor="environmental-device-name">{t("deviceName")}</Label>
        <Input
          id="environmental-device-name"
          value={name}
          maxLength={100}
          onChange={(event) => onNameChange(event.currentTarget.value)}
          placeholder={t("deviceNamePlaceholder")}
          required
        />
      </div>
      <Button type="submit" disabled={isWorking || !name.trim()}>
        {isWorking ? (
          <Loader2 className="mr-2 size-4 animate-spin" />
        ) : (
          <Plus className="mr-2 size-4" />
        )}
        {t("registerDevice")}
      </Button>
    </form>
  );
}

function OneTimeCredentialPanel({
  credential,
  copied,
  onCopy,
  onDismiss,
}: {
  credential: string;
  copied: boolean;
  onCopy: () => void;
  onDismiss: () => void;
}) {
  const t = useScopedI18n("settings.developer.environmentalDevices");
  return (
    <section
      aria-labelledby="device-credential-heading"
      className="space-y-3 rounded-lg border border-amber-500/40 bg-amber-500/5 p-4"
    >
      <div className="flex items-start gap-3">
        <ShieldCheck
          className="mt-0.5 size-5 text-amber-600"
          aria-hidden="true"
        />
        <div>
          <h3 id="device-credential-heading" className="font-medium">
            {t("credentialHeading")}
          </h3>
          <p className="mt-1 text-sm text-muted-foreground">
            {t("credentialDescription")}
          </p>
        </div>
      </div>
      <div className="flex items-center gap-2 rounded-md border border-border bg-background p-3">
        <code className="min-w-0 flex-1 break-all text-sm">{credential}</code>
        <Button
          type="button"
          variant="outline"
          size="icon"
          aria-label={t("copyCredential")}
          onClick={onCopy}
        >
          {copied ? (
            <Check className="size-4 text-green-600" />
          ) : (
            <Copy className="size-4" />
          )}
        </Button>
        <Button type="button" variant="ghost" onClick={onDismiss}>
          {t("dismiss")}
        </Button>
      </div>
      <details className="text-xs text-muted-foreground">
        <summary className="cursor-pointer">{t("receiverFormat")}</summary>
        <p className="mt-2">
          {t("receiverInstructions", {
            endpoint: "/v1/environmental-readings",
          })}
        </p>
        <pre className="mt-2 overflow-x-auto rounded-md border border-border bg-background p-3 text-foreground">{`{
  "readingId": "logger-1/000042",
  "probeId": "probe-1",
  "timestamp": "2026-10-04T10:30:00Z",
  "temperature": { "value": 20.2, "unit": "C" },
  "humidity": { "value": 48, "unit": "%" }
}`}</pre>
      </details>
    </section>
  );
}

function EnvironmentalDeviceList({
  devices,
  locations,
  probeForms,
  isWorking,
  onProbeFormChange,
  onBind,
  onRotate,
  onRevoke,
}: {
  devices: EnvironmentalDevice[] | undefined;
  locations: EnvironmentalLocation[];
  probeForms: Record<string, ProbeFormState>;
  isWorking: boolean;
  onProbeFormChange: (
    deviceId: Id<"environmentalDevices">,
    update: Partial<ProbeFormState>,
  ) => void;
  onBind: (
    deviceId: Id<"environmentalDevices">,
    event: FormEvent<HTMLFormElement>,
  ) => void;
  onRotate: (deviceId: Id<"environmentalDevices">) => void;
  onRevoke: (deviceId: Id<"environmentalDevices">) => void;
}) {
  const t = useScopedI18n("settings.developer.environmentalDevices");
  return (
    <div className="rounded-lg border border-border">
      {devices === undefined ? (
        <div className="flex justify-center p-8">
          <Loader2 className="size-5 animate-spin text-muted-foreground" />
        </div>
      ) : devices.length === 0 ? (
        <p className="p-8 text-center text-sm text-muted-foreground">
          {t("empty")}
        </p>
      ) : (
        <div className="divide-y divide-border">
          {devices.map((device) => (
            <EnvironmentalDeviceCard
              key={device._id}
              device={device}
              locations={locations}
              form={
                probeForms[device._id] ?? {
                  probeId: "",
                  locationId: locations[0]?._id ?? "",
                }
              }
              isWorking={isWorking}
              onProbeFormChange={onProbeFormChange}
              onBind={onBind}
              onRotate={onRotate}
              onRevoke={onRevoke}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function EnvironmentalDeviceCard({
  device,
  locations,
  form,
  isWorking,
  onProbeFormChange,
  onBind,
  onRotate,
  onRevoke,
}: {
  device: EnvironmentalDevice;
  locations: EnvironmentalLocation[];
  form: ProbeFormState;
  isWorking: boolean;
  onProbeFormChange: (
    deviceId: Id<"environmentalDevices">,
    update: Partial<ProbeFormState>,
  ) => void;
  onBind: (
    deviceId: Id<"environmentalDevices">,
    event: FormEvent<HTMLFormElement>,
  ) => void;
  onRotate: (deviceId: Id<"environmentalDevices">) => void;
  onRevoke: (deviceId: Id<"environmentalDevices">) => void;
}) {
  return (
    <article className="space-y-4 p-4">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <DeviceSummary device={device} />
        <DeviceActions
          device={device}
          isWorking={isWorking}
          onRotate={onRotate}
          onRevoke={onRevoke}
        />
      </div>
      <BoundProbes probes={device.probes} />
      {device.status === "active" && (
        <ProbeBindingForm
          deviceId={device._id}
          form={form}
          locations={locations}
          isWorking={isWorking}
          onChange={onProbeFormChange}
          onSubmit={onBind}
        />
      )}
    </article>
  );
}

function DeviceSummary({ device }: { device: EnvironmentalDevice }) {
  const t = useScopedI18n("settings.developer.environmentalDevices");
  return (
    <div className="space-y-1">
      <div className="flex items-center gap-2">
        <Thermometer
          className="size-4 text-muted-foreground"
          aria-hidden="true"
        />
        <h3 className="font-medium">{device.name}</h3>
        <span
          className={`rounded px-2 py-0.5 text-xs ${device.status === "active" ? "bg-emerald-500/10 text-emerald-700" : "bg-muted text-muted-foreground"}`}
        >
          {device.status === "active" ? t("statusActive") : t("statusRevoked")}
        </span>
      </div>
      <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
        <code>{device.credentialPrefix}…</code>
        <span>
          {t("created")} <ClientDateText timestamp={device.createdAt} />
        </span>
        {device.lastSeenAt ? (
          <span>
            {t("lastSeen")} <ClientDateText timestamp={device.lastSeenAt} />
          </span>
        ) : (
          <span>{t("noRequests")}</span>
        )}
      </div>
      {device.lastError && (
        <p className="text-xs text-destructive">
          {t("lastError")}: {device.lastError}
          {device.lastErrorAt && (
            <>
              {" "}
              · <ClientDateText timestamp={device.lastErrorAt} />
            </>
          )}
        </p>
      )}
    </div>
  );
}

function DeviceActions({
  device,
  isWorking,
  onRotate,
  onRevoke,
}: {
  device: EnvironmentalDevice;
  isWorking: boolean;
  onRotate: (deviceId: Id<"environmentalDevices">) => void;
  onRevoke: (deviceId: Id<"environmentalDevices">) => void;
}) {
  const t = useScopedI18n("settings.developer.environmentalDevices");
  return (
    <div className="flex items-center gap-2">
      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={isWorking}
        onClick={() => onRotate(device._id)}
      >
        <RotateCw className="mr-2 size-3.5" />
        {t("rotateCredential")}
      </Button>
      {device.status === "active" && (
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button
              type="button"
              variant="destructive"
              size="sm"
              disabled={isWorking}
            >
              {t("revoke")}
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>
                {t("revokeTitle", { name: device.name })}
              </AlertDialogTitle>
              <AlertDialogDescription>
                {t("revokeDescription")}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>{t("cancel")}</AlertDialogCancel>
              <AlertDialogAction onClick={() => onRevoke(device._id)}>
                {t("revokeDevice")}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}
    </div>
  );
}

function BoundProbes({ probes }: { probes: EnvironmentalDevice["probes"] }) {
  const t = useScopedI18n("settings.developer.environmentalDevices");
  return (
    <div className="space-y-2">
      <h4 className="text-sm font-medium">{t("boundProbes")}</h4>
      {probes.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t("noBoundProbes")}</p>
      ) : (
        <ul className="space-y-1 text-sm">
          {probes.map((probe) => (
            <li
              key={probe._id}
              className="flex flex-wrap gap-x-2 text-muted-foreground"
            >
              <code>{probe.probeId}</code>
              <span>→</span>
              <span>{probe.locationName}</span>
              {!probe.isActive && <span>({t("inactive")})</span>}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function ProbeBindingForm({
  deviceId,
  form,
  locations,
  isWorking,
  onChange,
  onSubmit,
}: {
  deviceId: Id<"environmentalDevices">;
  form: ProbeFormState;
  locations: EnvironmentalLocation[];
  isWorking: boolean;
  onChange: (
    deviceId: Id<"environmentalDevices">,
    update: Partial<ProbeFormState>,
  ) => void;
  onSubmit: (
    deviceId: Id<"environmentalDevices">,
    event: FormEvent<HTMLFormElement>,
  ) => void;
}) {
  const t = useScopedI18n("settings.developer.environmentalDevices");
  return (
    <form
      onSubmit={(event) => onSubmit(deviceId, event)}
      className="flex flex-wrap items-end gap-3 border-t border-border/60 pt-4"
    >
      <div className="min-w-40 flex-1 space-y-2">
        <Label htmlFor={`probe-id-${deviceId}`}>{t("probeId")}</Label>
        <Input
          id={`probe-id-${deviceId}`}
          value={form.probeId}
          maxLength={100}
          onChange={(event) =>
            onChange(deviceId, { probeId: event.currentTarget.value })
          }
          placeholder={t("probeIdPlaceholder")}
          required
        />
      </div>
      <div className="min-w-48 flex-1 space-y-2">
        <Label htmlFor={`probe-location-${deviceId}`}>{t("location")}</Label>
        <select
          id={`probe-location-${deviceId}`}
          value={form.locationId}
          onChange={(event) =>
            onChange(deviceId, { locationId: event.currentTarget.value })
          }
          className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
          required
          disabled={!locations.length}
        >
          {locations.map((location) => (
            <option key={location._id} value={location._id}>
              {location.name} · {location.type}
            </option>
          ))}
        </select>
      </div>
      <Button
        type="submit"
        variant="outline"
        disabled={isWorking || !locations.length || !form.probeId.trim()}
      >
        {t("bindProbe")}
      </Button>
    </form>
  );
}
