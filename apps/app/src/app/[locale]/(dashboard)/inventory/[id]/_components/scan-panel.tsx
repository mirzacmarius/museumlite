"use client";

import { api } from "@v1/backend/convex/_generated/api";
import type { Id } from "@v1/backend/convex/_generated/dataModel";
import type { InventoryObservationOutcome } from "@v1/backend/convex/utils/inventoryValidators";
import { Badge } from "@v1/ui/badge";
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
import { useMutation } from "convex/react";
import { type FormEvent, useEffect, useReducer, useRef, useState } from "react";
import { ActionRefusal, type Refusal } from "@/components/action-refusal";
import { BarcodeScanner } from "@/components/barcode-scanner";
import { useInventoryErrorMessage } from "@/hooks/use-inventory-error-message";
import { useScopedI18n } from "@/locales/client";
import { formatLocationLabel } from "../../../locations/location-label";
import { ObservationOutcome } from "./observation-outcome";
import type { SessionView } from "./session-types";

const KEPT_SCANS = 20;
const MAX_VALUE_LENGTH = 500;
const MAX_NOTE_LENGTH = 1000;

interface LocalScan {
  clientObservationId: string;
  scannedValue: string;
  method: "scan" | "manual";
  observedLocationId: Id<"locations">;
  note?: string;
  state: "saving" | "saved" | "failed";
  error?: string;
  outcome?: InventoryObservationOutcome;
  accessionNumber?: string;
  title?: string;
  recordedLocationName?: string;
  alreadyRecorded?: boolean;
}

/** The location id in a location label URL (`…/locations/<id>`), if any. */
function locationIdFromLabel(value: string) {
  try {
    const segments = new URL(value).pathname.split("/").filter(Boolean);
    const index = segments.lastIndexOf("locations");
    return index === -1 ? undefined : segments[index + 1];
  } catch {
    return undefined;
  }
}

function newScanId() {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

interface ScanLog {
  scans: LocalScan[];
  refusal: Refusal | null;
  announcement: string;
}

type ScanLogAction =
  | { type: "added"; scan: LocalScan }
  | { type: "updated"; clientObservationId: string; patch: Partial<LocalScan> }
  | { type: "refused"; message: string | null }
  | { type: "announced"; text: string };

function scanLogReducer(log: ScanLog, action: ScanLogAction): ScanLog {
  switch (action.type) {
    case "added":
      return {
        ...log,
        scans: [action.scan, ...log.scans].slice(0, KEPT_SCANS),
      };
    case "updated":
      return {
        ...log,
        scans: log.scans.map((scan) =>
          scan.clientObservationId === action.clientObservationId
            ? { ...scan, ...action.patch }
            : scan,
        ),
      };
    case "refused":
      return {
        ...log,
        refusal: action.message ? { message: action.message } : null,
      };
    case "announced":
      return { ...log, announcement: action.text };
  }
}

/**
 * Records observations for one session. Each scan has its own identifier, so
 * retrying one whose answer was lost records nothing twice. A scan that did
 * not save is shown as not saved until it is retried; nothing is stored on
 * the device.
 */
export function ScanPanel({ session }: { session: SessionView }) {
  const t = useScopedI18n("inventory.scan");
  const tErrors = useScopedI18n("inventory.errors");
  const errorMessage = useInventoryErrorMessage();
  const recordObservation = useMutation(api.inventory.recordObservation);
  const [chosenLocationId, setLocationId] = useState<Id<"locations"> | null>(
    null,
  );
  const locationId = chosenLocationId ?? session.scopeLocationId;
  const [value, setValue] = useState("");
  const [note, setNote] = useState("");
  const [{ scans, refusal, announcement }, dispatch] = useReducer(
    scanLogReducer,
    { scans: [], refusal: null, announcement: "" },
  );
  const setRefusal = (next: Refusal | null) =>
    dispatch({ type: "refused", message: next?.message ?? null });
  const setAnnouncement = (text: string) =>
    dispatch({ type: "announced", text });
  const locationNames = new Map(
    session.scopeLocations.map((location) => [location._id, location.name]),
  );

  function update(clientObservationId: string, patch: Partial<LocalScan>) {
    dispatch({ type: "updated", clientObservationId, patch });
  }

  async function submit(scan: LocalScan) {
    update(scan.clientObservationId, { state: "saving", error: undefined });
    try {
      const result = await recordObservation({
        sessionId: session._id,
        clientObservationId: scan.clientObservationId,
        scannedValue: scan.scannedValue,
        method: scan.method,
        observedLocationId: scan.observedLocationId,
        note: scan.note,
      });
      update(scan.clientObservationId, {
        state: "saved",
        outcome: result.outcome,
        accessionNumber: result.object?.accessionNumber,
        title: result.object?.title,
        recordedLocationName: result.object?.recordedLocationName,
        alreadyRecorded: result.alreadyRecorded,
      });
      setAnnouncement(
        `${result.object?.accessionNumber ?? scan.scannedValue}: ${t(`outcomes.${result.outcome}`, { location: result.object?.recordedLocationName ?? "" })}`,
      );
    } catch (error) {
      const message = errorMessage(error);
      update(scan.clientObservationId, { state: "failed", error: message });
      setAnnouncement(`${scan.scannedValue}: ${t("notSaved")}. ${message}`);
    }
  }

  function capture(raw: string, method: "scan" | "manual", scanNote?: string) {
    const scannedValue = raw.trim();
    if (!scannedValue) return false;
    setRefusal(null);
    const labelledLocation = locationIdFromLabel(scannedValue);
    if (labelledLocation !== undefined) {
      const inScope = session.scopeLocations.find(
        (location) => location._id === labelledLocation,
      );
      if (!inScope) {
        setRefusal({ message: t("locationOutOfScope") });
        return true;
      }
      setLocationId(inScope._id);
      setAnnouncement(t("switchedLocation", { location: inScope.name }));
      return true;
    }
    const scan: LocalScan = {
      clientObservationId: newScanId(),
      scannedValue: scannedValue.slice(0, MAX_VALUE_LENGTH),
      method,
      observedLocationId: locationId,
      note: scanNote?.trim() || undefined,
      state: "saving",
    };
    dispatch({ type: "added", scan });
    void submit(scan);
    return true;
  }

  // The camera keeps the callback it started with; read the latest state.
  const captureRef = useRef(capture);
  useEffect(() => {
    captureRef.current = capture;
  });

  function handleManual(event: FormEvent) {
    event.preventDefault();
    if (!value.trim()) {
      setRefusal({ message: tErrors("scanValueRequired") });
      document.getElementById("inventory-scan-value")?.focus();
      return;
    }
    capture(value, "manual", note);
    setValue("");
    setNote("");
    document.getElementById("inventory-scan-value")?.focus();
  }

  return (
    <div className="space-y-6">
      <div className="space-y-1.5">
        <Label htmlFor="inventory-scan-location">{t("currentLocation")}</Label>
        <Select
          value={locationId}
          onValueChange={(next) => setLocationId(next as Id<"locations">)}
        >
          <SelectTrigger
            id="inventory-scan-location"
            className="h-auto min-h-9 whitespace-normal text-left"
          >
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {session.scopeLocations.map((location) => (
              <SelectItem key={location._id} value={location._id}>
                {location.locationCode
                  ? formatLocationLabel(location.locationCode, location.name)
                  : location.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <section
          aria-labelledby="inventory-scan-manual"
          className="space-y-3 rounded-xl border border-border bg-card p-4"
        >
          <h2 id="inventory-scan-manual" className="text-sm font-medium">
            {t("manualTitle")}
          </h2>
          <form onSubmit={handleManual} className="space-y-3" noValidate>
            <div className="space-y-1.5">
              <Label htmlFor="inventory-scan-value">{t("manualLabel")}</Label>
              <Input
                id="inventory-scan-value"
                value={value}
                maxLength={MAX_VALUE_LENGTH}
                autoComplete="off"
                autoCapitalize="off"
                spellCheck={false}
                aria-describedby="inventory-scan-value-hint"
                onChange={(event) => setValue(event.target.value)}
              />
              <p
                id="inventory-scan-value-hint"
                className="text-xs text-muted-foreground"
              >
                {t("manualHint")}
              </p>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="inventory-scan-note">{t("note")}</Label>
              <Input
                id="inventory-scan-note"
                value={note}
                maxLength={MAX_NOTE_LENGTH}
                onChange={(event) => setNote(event.target.value)}
              />
            </div>
            <Button type="submit">{t("record")}</Button>
          </form>
          <ActionRefusal refusal={refusal} />
        </section>

        <section
          aria-labelledby="inventory-scan-camera"
          className="space-y-3 rounded-xl border border-border bg-card p-4"
        >
          <h2 id="inventory-scan-camera" className="text-sm font-medium">
            {t("cameraTitle")}
          </h2>
          <BarcodeScanner
            onScanSuccess={(text) => captureRef.current(text, "scan")}
            onScanError={(error) =>
              setRefusal({ message: t("cameraError", { error }) })
            }
            qrbox={240}
          />
        </section>
      </div>

      <p role="status" aria-live="polite" className="sr-only">
        {announcement}
      </p>

      {scans.length > 0 ? (
        <section aria-labelledby="inventory-scan-recent" className="space-y-2">
          <div>
            <h2 id="inventory-scan-recent" className="text-sm font-medium">
              {t("lastScans")}
            </h2>
            <p className="text-xs text-muted-foreground">
              {t("lastScansHint")}
            </p>
          </div>
          <ul className="divide-y divide-border rounded-xl border border-border">
            {scans.map((scan) => (
              <li key={scan.clientObservationId} className="space-y-1 p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="break-all font-mono text-sm">
                    {scan.accessionNumber ?? scan.scannedValue}
                  </span>
                  {scan.state === "failed" ? (
                    <Badge variant="destructive">{t("notSaved")}</Badge>
                  ) : scan.state === "saving" ? (
                    <Badge variant="outline">{t("recording")}</Badge>
                  ) : scan.alreadyRecorded ? (
                    <Badge variant="secondary">{t("alreadyRecorded")}</Badge>
                  ) : null}
                </div>
                {scan.title ? (
                  <p className="break-words text-sm">{scan.title}</p>
                ) : null}
                {scan.outcome ? (
                  <ObservationOutcome
                    outcome={scan.outcome}
                    observedLocationName={locationNames.get(
                      scan.observedLocationId,
                    )}
                    recordedLocationName={scan.recordedLocationName}
                  />
                ) : null}
                {scan.state === "failed" ? (
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-xs text-destructive">{scan.error}</p>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => void submit(scan)}
                    >
                      {t("retry")}
                    </Button>
                  </div>
                ) : null}
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
