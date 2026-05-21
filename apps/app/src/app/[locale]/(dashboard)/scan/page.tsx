"use client";

import { api } from "@v1/backend/convex/_generated/api";
import type { Id } from "@v1/backend/convex/_generated/dataModel";
import { Button } from "@v1/ui/button";
import { useQuery } from "convex/react";
import {
  AlertCircle,
  Building2,
  Camera,
  Clock,
  ExternalLink,
  Plus,
  ScanLine,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useReducer, useRef } from "react";
import { toast } from "sonner";
import { BarcodeScanner } from "@/components/barcode-scanner";
import { useOrganization } from "@/components/organization-provider";
import { useScopedI18n } from "@/locales/client";
import { ScanPageSkeleton } from "./scan-page-skeleton";

interface ScanHistoryItem {
  id: string;
  accessionNumber: string;
  format: string;
  timestamp: Date;
  found: boolean;
  objectId?: Id<"collections">;
  objectTitle?: string;
}

interface ScanPageState {
  scanHistory: ScanHistoryItem[];
  pendingLookup: string | null;
}

type ScanPageAction =
  | { type: "scan"; item: ScanHistoryItem; lookupAccession: string | null }
  | {
      type: "lookup_found";
      accessionNumber: string;
      objectId: Id<"collections">;
      objectTitle: string;
    }
  | { type: "lookup_not_found"; accessionNumber: string };

function scanPageReducer(
  state: ScanPageState,
  action: ScanPageAction,
): ScanPageState {
  switch (action.type) {
    case "scan":
      return {
        scanHistory: [action.item, ...state.scanHistory.slice(0, 9)],
        pendingLookup: action.lookupAccession,
      };
    case "lookup_found":
      return {
        pendingLookup: null,
        scanHistory: state.scanHistory.map((item) =>
          item.accessionNumber === action.accessionNumber
            ? {
                ...item,
                found: true,
                objectId: action.objectId,
                objectTitle: action.objectTitle,
              }
            : item,
        ),
      };
    case "lookup_not_found":
      return {
        pendingLookup: null,
        scanHistory: state.scanHistory.map((item) =>
          item.accessionNumber === action.accessionNumber
            ? { ...item, found: false }
            : item,
        ),
      };
    default:
      return state;
  }
}

type AccessionLookupResult =
  | {
      kind: "found";
      accessionNumber: string;
      object: { _id: Id<"collections">; title: string };
    }
  | { kind: "not_found"; accessionNumber: string };

function AccessionLookup({
  accessionNumber,
  organizationId,
  onResolved,
}: {
  accessionNumber: string;
  organizationId: Id<"organizations">;
  onResolved: (result: AccessionLookupResult) => void;
}) {
  const { push } = useRouter();
  const scannedObject = useQuery(api.collections.getByAccessionNumber, {
    organizationId,
    accessionNumber,
  });
  const handledRef = useRef(false);

  useEffect(() => {
    if (scannedObject === undefined) return;
    if (handledRef.current) return;
    handledRef.current = true;

    if (scannedObject) {
      onResolved({
        kind: "found",
        accessionNumber,
        object: scannedObject,
      });
      push(`/objects/${scannedObject._id}`);
      return;
    }

    onResolved({ kind: "not_found", accessionNumber });
  }, [scannedObject, accessionNumber, push, onResolved]);

  return null;
}

function getObjectPathFromScan(decodedText: string) {
  const trimmedText = decodedText.trim();
  const baseUrl =
    typeof window !== "undefined"
      ? window.location.origin
      : "https://app.museumlite.com";

  try {
    const url = new URL(trimmedText, baseUrl);
    const segments = url.pathname.split("/").filter(Boolean);
    const objectsSegmentIndex = segments.indexOf("objects");
    const objectId =
      objectsSegmentIndex === -1
        ? undefined
        : segments[objectsSegmentIndex + 1];

    return objectId ? `/objects/${encodeURIComponent(objectId)}` : null;
  } catch {
    return null;
  }
}

export default function ScanPage() {
  const _t = useScopedI18n("objects");
  const common = useScopedI18n("common");
  const { currentOrganizationId, organizations, isLoading } = useOrganization();
  const { push } = useRouter();
  const [{ scanHistory, pendingLookup }, dispatch] = useReducer(scanPageReducer, {
    scanHistory: [],
    pendingLookup: null,
  });

  const handleLookupResolved = useCallback((result: AccessionLookupResult) => {
    if (result.kind === "found") {
      dispatch({
        type: "lookup_found",
        accessionNumber: result.accessionNumber,
        objectId: result.object._id,
        objectTitle: result.object.title,
      });
      return;
    }

    toast.error(`Object not found: ${result.accessionNumber}`);
    dispatch({
      type: "lookup_not_found",
      accessionNumber: result.accessionNumber,
    });
  }, []);

  const handleScanSuccess = useCallback(
    (decodedText: string, format: string) => {
      if (!currentOrganizationId) {
        toast.error("Please select an organization first");
        return;
      }

      const objectPath = getObjectPathFromScan(decodedText);
      toast.success(`Scanned: ${decodedText}`);

      const historyItem: ScanHistoryItem = {
        id: `${Date.now()}-${decodedText}`,
        accessionNumber: decodedText,
        format,
        timestamp: new Date(),
        found: objectPath !== null,
      };

      dispatch({
        type: "scan",
        item: historyItem,
        lookupAccession: objectPath ? null : decodedText,
      });

      if (objectPath) {
        push(objectPath);
      }
    },
    [currentOrganizationId, push],
  );

  const handleScanError = useCallback((error: string) => {
    toast.error(`Scanner error: ${error}`);
  }, []);

  if (isLoading) {
    return <ScanPageSkeleton />;
  }

  if (!organizations || organizations.length === 0) {
    return (
      <div className="flex size-full items-center justify-center bg-background px-6 py-8">
        <div className="flex flex-col items-center gap-4 rounded-lg border border-border/60 bg-card p-8">
          <Building2 className="size-12 text-muted-foreground" />
          <div className="text-center">
            <h3 className="text-lg font-semibold">No Organization</h3>
            <p className="mt-2 text-sm text-muted-foreground">
              You need to create or join an organization to scan objects.
            </p>
          </div>
          <Button asChild>
            <Link href="/organizations/new">
              <Plus className="mr-2 size-4" />
              {common("create")}
            </Link>
          </Button>
        </div>
      </div>
    );
  }

  if (!currentOrganizationId) {
    return (
      <div className="flex size-full items-center justify-center bg-background px-6 py-8">
        <div className="flex flex-col items-center gap-4 rounded-lg border border-border/60 bg-card p-8">
          <Building2 className="size-12 text-muted-foreground" />
          <div className="text-center">
            <h3 className="text-lg font-semibold">Select Organization</h3>
            <p className="mt-2 text-sm text-muted-foreground">
              Please select an organization to start scanning.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex size-full flex-col overflow-y-auto bg-background">
      <div className="mx-auto w-full max-w-4xl space-y-6 p-4 sm:p-6">
        {/* Header */}
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-3">
            <div className="flex size-10 items-center justify-center rounded-lg bg-primary/10">
              <ScanLine className="size-5 text-primary" />
            </div>
            <div>
              <h1 className="text-2xl font-semibold tracking-tight">
                Scan Objects
              </h1>
              <p className="text-sm text-muted-foreground">
                Scan barcodes or QR codes to quickly access object records
              </p>
            </div>
          </div>
        </div>

        {pendingLookup && (
          <AccessionLookup
            key={pendingLookup}
            accessionNumber={pendingLookup}
            organizationId={currentOrganizationId}
            onResolved={handleLookupResolved}
          />
        )}

        {/* Scanner */}
        <div className="rounded-lg border border-border bg-card p-4 sm:p-6">
          <BarcodeScanner
            onScanSuccess={handleScanSuccess}
            onScanError={handleScanError}
            qrbox={300}
            fps={10}
          />
        </div>

        {/* Scan History */}
        {scanHistory.length > 0 && (
          <div className="rounded-lg border border-border bg-card">
            <div className="border-b border-border px-4 py-3 sm:px-6">
              <div className="flex items-center gap-2">
                <Clock className="size-4 text-muted-foreground" />
                <h2 className="text-sm font-medium">Recent Scans</h2>
              </div>
            </div>
            <div className="divide-y divide-border">
              {scanHistory.map((item) => (
                <div
                  key={item.id}
                  className="flex items-center justify-between gap-4 px-4 py-3 sm:px-6"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium truncate">
                        {item.accessionNumber}
                      </p>
                      <span className="text-xs text-muted-foreground">
                        ({item.format})
                      </span>
                    </div>
                    {item.found && item.objectTitle && (
                      <p className="text-xs text-muted-foreground mt-0.5 truncate">
                        {item.objectTitle}
                      </p>
                    )}
                    {!item.found && (
                      <p className="text-xs text-muted-foreground mt-0.5">
                        Not found
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <span className="text-xs text-muted-foreground whitespace-nowrap">
                      {item.timestamp.toLocaleTimeString([], {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </span>
                    {item.found && item.objectId && (
                      <Button
                        asChild
                        variant="ghost"
                        size="sm"
                        className="size-7 p-0"
                      >
                        <Link href={`/objects/${item.objectId}`}>
                          <ExternalLink className="size-3.5" />
                        </Link>
                      </Button>
                    )}
                    {!item.found && (
                      <div className="flex size-7 items-center justify-center">
                        <AlertCircle className="size-3.5 text-destructive" />
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Info Cards */}
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="rounded-lg border border-border bg-card p-4">
            <div className="flex items-start gap-3">
              <div className="flex size-8 flex-shrink-0 items-center justify-center rounded-lg bg-primary/10">
                <Camera className="size-4 text-primary" />
              </div>
              <div className="flex-1">
                <h3 className="text-sm font-medium">How to Scan</h3>
                <p className="mt-1 text-xs text-muted-foreground">
                  Start the scanner and position the barcode or QR code within
                  the camera view. The system will automatically detect and
                  navigate to the object.
                </p>
              </div>
            </div>
          </div>

          <div className="rounded-lg border border-border bg-card p-4">
            <div className="flex items-start gap-3">
              <div className="flex size-8 flex-shrink-0 items-center justify-center rounded-lg bg-primary/10">
                <ScanLine className="size-4 text-primary" />
              </div>
              <div className="flex-1">
                <h3 className="text-sm font-medium">Supported Formats</h3>
                <p className="mt-1 text-xs text-muted-foreground">
                  QR codes, Code 128, and Code 39 barcodes are supported. Make
                  sure there's adequate lighting for best results.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
