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
import {
  Check,
  Copy,
  Loader2,
  Plus,
  RotateCw,
  ShieldCheck,
  Thermometer,
} from "lucide-react";
import { type FormEvent, useState } from "react";
import { PermissionGate } from "@/components/permission-gate";
import { writeTextToClipboard } from "@/lib/clipboard";
import { ClientDateText } from "./developer-shared";

interface ProbeFormState {
  probeId: string;
  locationId: string;
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
  const devices = useQuery(api.environmentalDevices.list, { organizationId });
  const locations = useQuery(api.environmentalDevices.listLocations, {
    organizationId,
  });
  const registerDevice = useMutation(api.environmentalDevices.register);
  const bindProbe = useMutation(api.environmentalDevices.bindProbe);
  const rotateDevice = useMutation(api.environmentalDevices.rotate);
  const revokeDevice = useMutation(api.environmentalDevices.revoke);
  const [name, setName] = useState("");
  const [probeForms, setProbeForms] = useState<Record<string, ProbeFormState>>(
    {},
  );
  const [oneTimeCredential, setOneTimeCredential] = useState<string | null>(
    null,
  );
  const [error, setError] = useState<string | null>(null);
  const [isWorking, setIsWorking] = useState(false);
  const [copied, setCopied] = useState(false);

  const updateProbeForm = (
    deviceId: Id<"environmentalDevices">,
    update: Partial<ProbeFormState>,
  ) => {
    setProbeForms((current) => ({
      ...current,
      [deviceId]: {
        probeId: current[deviceId]?.probeId ?? "",
        locationId: current[deviceId]?.locationId ?? locations?.[0]?._id ?? "",
        ...update,
      },
    }));
  };

  const handleRegister = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!name.trim()) return;
    setError(null);
    setIsWorking(true);
    try {
      const result = await registerDevice({
        organizationId,
        name: name.trim(),
      });
      setOneTimeCredential(result.token);
      setName("");
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "Could not register device.",
      );
    } finally {
      setIsWorking(false);
    }
  };

  const handleBind = async (
    deviceId: Id<"environmentalDevices">,
    event: FormEvent<HTMLFormElement>,
  ) => {
    event.preventDefault();
    const form = probeForms[deviceId];
    if (!form?.probeId.trim() || !form.locationId) return;
    setError(null);
    setIsWorking(true);
    try {
      await bindProbe({
        organizationId,
        deviceId,
        probeId: form.probeId.trim(),
        locationId: form.locationId as Id<"locations">,
      });
      updateProbeForm(deviceId, { probeId: "" });
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "Could not bind probe.",
      );
    } finally {
      setIsWorking(false);
    }
  };

  const handleRotate = async (deviceId: Id<"environmentalDevices">) => {
    setError(null);
    setIsWorking(true);
    try {
      const result = await rotateDevice({ organizationId, deviceId });
      setOneTimeCredential(result.token);
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "Could not rotate credential.",
      );
    } finally {
      setIsWorking(false);
    }
  };

  const handleRevoke = async (deviceId: Id<"environmentalDevices">) => {
    setError(null);
    setIsWorking(true);
    try {
      await revokeDevice({ organizationId, deviceId });
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "Could not revoke device.",
      );
    } finally {
      setIsWorking(false);
    }
  };

  const copyCredential = async () => {
    if (oneTimeCredential && (await writeTextToClipboard(oneTimeCredential))) {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold">Environmental devices</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Register generic authenticated loggers and bind each probe to a
          location.
        </p>
      </div>

      <form
        onSubmit={handleRegister}
        className="flex flex-wrap items-end gap-3 rounded-lg border border-border p-4"
      >
        <div className="min-w-56 flex-1 space-y-2">
          <Label htmlFor="environmental-device-name">Device name</Label>
          <Input
            id="environmental-device-name"
            value={name}
            maxLength={100}
            onChange={(event) => setName(event.currentTarget.value)}
            placeholder="Storage logger"
            required
          />
        </div>
        <Button type="submit" disabled={isWorking || !name.trim()}>
          {isWorking ? (
            <Loader2 className="mr-2 size-4 animate-spin" />
          ) : (
            <Plus className="mr-2 size-4" />
          )}
          Register device
        </Button>
      </form>

      {oneTimeCredential && (
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
                Save this device credential now
              </h3>
              <p className="mt-1 text-sm text-muted-foreground">
                It is shown once and cannot be retrieved later. Rotate it if it
                is lost.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 rounded-md border border-border bg-background p-3">
            <code className="min-w-0 flex-1 break-all text-sm">
              {oneTimeCredential}
            </code>
            <Button
              type="button"
              variant="outline"
              size="icon"
              aria-label="Copy credential"
              onClick={copyCredential}
            >
              {copied ? (
                <Check className="size-4 text-green-600" />
              ) : (
                <Copy className="size-4" />
              )}
            </Button>
            <Button
              type="button"
              variant="ghost"
              onClick={() => setOneTimeCredential(null)}
            >
              Dismiss
            </Button>
          </div>
          <details className="text-xs text-muted-foreground">
            <summary className="cursor-pointer">Receiver format</summary>
            <p className="mt-2">
              POST JSON to <code>/v1/environmental-readings</code> with this
              credential as a Bearer token. Temperature units are C or F;
              humidity units are percent.
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
      )}

      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}

      <div className="rounded-lg border border-border">
        {devices === undefined ? (
          <div className="flex justify-center p-8">
            <Loader2 className="size-5 animate-spin text-muted-foreground" />
          </div>
        ) : devices.length === 0 ? (
          <p className="p-8 text-center text-sm text-muted-foreground">
            No environmental devices registered.
          </p>
        ) : (
          <div className="divide-y divide-border">
            {devices.map((device) => {
              const form = probeForms[device._id] ?? {
                probeId: "",
                locationId: locations?.[0]?._id ?? "",
              };
              return (
                <article key={device._id} className="space-y-4 p-4">
                  <div className="flex flex-wrap items-start justify-between gap-4">
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
                          {device.status}
                        </span>
                      </div>
                      <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                        <code>{device.credentialPrefix}…</code>
                        <span>
                          Created{" "}
                          <ClientDateText timestamp={device.createdAt} />
                        </span>
                        {device.lastSeenAt && (
                          <span>
                            Last seen{" "}
                            <ClientDateText timestamp={device.lastSeenAt} />
                          </span>
                        )}
                        {!device.lastSeenAt && (
                          <span>No authenticated requests</span>
                        )}
                      </div>
                      {device.lastError && (
                        <p className="text-xs text-destructive">
                          Last error: {device.lastError}
                          {device.lastErrorAt && (
                            <>
                              {" "}
                              ·{" "}
                              <ClientDateText timestamp={device.lastErrorAt} />
                            </>
                          )}
                        </p>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        disabled={isWorking}
                        onClick={() => handleRotate(device._id)}
                      >
                        <RotateCw className="mr-2 size-3.5" />
                        Rotate credential
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
                              Revoke
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>
                                Revoke {device.name}?
                              </AlertDialogTitle>
                              <AlertDialogDescription>
                                Requests with this device credential will stop
                                being accepted immediately.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancel</AlertDialogCancel>
                              <AlertDialogAction
                                onClick={() => handleRevoke(device._id)}
                              >
                                Revoke device
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      )}
                    </div>
                  </div>
                  <div className="space-y-2">
                    <h4 className="text-sm font-medium">Bound probes</h4>
                    {device.probes.length === 0 ? (
                      <p className="text-sm text-muted-foreground">
                        No probes bound to a location.
                      </p>
                    ) : (
                      <ul className="space-y-1 text-sm">
                        {device.probes.map((probe) => (
                          <li
                            key={probe._id}
                            className="flex flex-wrap gap-x-2 text-muted-foreground"
                          >
                            <code>{probe.probeId}</code>
                            <span>→</span>
                            <span>{probe.locationName}</span>
                            {!probe.isActive && <span>(inactive)</span>}
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                  {device.status === "active" && (
                    <form
                      onSubmit={(event) => handleBind(device._id, event)}
                      className="flex flex-wrap items-end gap-3 border-t border-border/60 pt-4"
                    >
                      <div className="min-w-40 flex-1 space-y-2">
                        <Label htmlFor={`probe-id-${device._id}`}>
                          Probe ID
                        </Label>
                        <Input
                          id={`probe-id-${device._id}`}
                          value={form.probeId}
                          maxLength={100}
                          onChange={(event) =>
                            updateProbeForm(device._id, {
                              probeId: event.currentTarget.value,
                            })
                          }
                          placeholder="probe-1"
                          required
                        />
                      </div>
                      <div className="min-w-48 flex-1 space-y-2">
                        <Label htmlFor={`probe-location-${device._id}`}>
                          Location
                        </Label>
                        <select
                          id={`probe-location-${device._id}`}
                          value={form.locationId}
                          onChange={(event) =>
                            updateProbeForm(device._id, {
                              locationId: event.currentTarget.value,
                            })
                          }
                          className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
                          required
                          disabled={!locations?.length}
                        >
                          {locations?.map((location) => (
                            <option key={location._id} value={location._id}>
                              {location.name} · {location.type}
                            </option>
                          ))}
                        </select>
                      </div>
                      <Button
                        type="submit"
                        variant="outline"
                        disabled={
                          isWorking ||
                          !locations?.length ||
                          !form.probeId.trim()
                        }
                      >
                        Bind probe
                      </Button>
                    </form>
                  )}
                </article>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
