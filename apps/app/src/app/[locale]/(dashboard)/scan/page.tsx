"use client";

import { BarcodeScanner } from "@/components/barcode-scanner";
import { useOrganization } from "@/components/organization-provider";
import { useScopedI18n } from "@/locales/client";
import { api } from "@v1/backend/convex/_generated/api";
import type { Id } from "@v1/backend/convex/_generated/dataModel";
import { Button } from "@v1/ui/button";
import { EmptyState } from "@v1/ui/empty-state";
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
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
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
  const t = useScopedI18n("objects");
  const common = useScopedI18n("common");
  const { currentOrganizationId, organizations, isLoading } = useOrganization();
  const router = useRouter();

  const [scanHistory, setScanHistory] = useState<ScanHistoryItem[]>([]);
  const [currentScan, setCurrentScan] = useState<string | null>(null);
  const handledScanRef = useRef<string | null>(null);

  // Query to find object by accession number
  const scannedObject = useQuery(
    api.collections.getByAccessionNumber,
    currentScan && currentOrganizationId
      ? {
          organizationId: currentOrganizationId,
          accessionNumber: currentScan,
        }
      : "skip",
  );

  const handleScanSuccess = useCallback(
    (decodedText: string, format: string) => {
      if (!currentOrganizationId) {
        toast.error("Please select an organization first");
        return;
      }

      const objectPath = getObjectPathFromScan(decodedText);
      toast.success(`Scanned: ${decodedText}`);

      // Add to history
      const historyItem: ScanHistoryItem = {
        id: `${Date.now()}-${decodedText}`,
        accessionNumber: decodedText,
        format,
        timestamp: new Date(),
        found: objectPath !== null,
      };

      setScanHistory((prev) => [historyItem, ...prev.slice(0, 9)]);

      if (objectPath) {
        router.push(objectPath);
        return;
      }

      setCurrentScan(decodedText);
    },
    [currentOrganizationId, router],
  );

  const handleScanError = useCallback((error: string) => {
    toast.error(`Scanner error: ${error}`);
  }, []);

  useEffect(() => {
    if (!currentScan || scannedObject === undefined) return;
    if (handledScanRef.current === currentScan) return;
    handledScanRef.current = currentScan;

    if (scannedObject) {
      setScanHistory((prev) =>
        prev.map((item) =>
          item.accessionNumber === currentScan
            ? {
                ...item,
                found: true,
                objectId: scannedObject._id,
                objectTitle: scannedObject.title,
              }
            : item,
        ),
      );
      router.push(`/objects/${scannedObject._id}`);
      setCurrentScan(null);
      return;
    }

    toast.error(`Object not found: ${currentScan}`);
    setScanHistory((prev) =>
      prev.map((item) =>
        item.accessionNumber === currentScan ? { ...item, found: false } : item,
      ),
    );
    setCurrentScan(null);
  }, [currentScan, scannedObject, router]);

  useEffect(() => {
    if (!currentScan) {
      handledScanRef.current = null;
    }
  }, [currentScan]);

  if (isLoading) {
    return <ScanPageSkeleton />;
  }

  if (!organizations || organizations.length === 0) {
    return (
      <div className="flex h-full w-full items-center justify-center bg-background px-6 py-8">
        <div className="flex flex-col items-center gap-4 rounded-lg border border-border/60 bg-card p-8">
          <Building2 className="h-12 w-12 text-muted-foreground" />
          <div className="text-center">
            <h3 className="text-lg font-semibold">No Organization</h3>
            <p className="mt-2 text-sm text-muted-foreground">
              You need to create or join an organization to scan objects.
            </p>
          </div>
          <Button asChild>
            <Link href="/organizations/new">
              <Plus className="mr-2 h-4 w-4" />
              {common("create")}
            </Link>
          </Button>
        </div>
      </div>
    );
  }

  if (!currentOrganizationId) {
    return (
      <div className="flex h-full w-full items-center justify-center bg-background px-6 py-8">
        <div className="flex flex-col items-center gap-4 rounded-lg border border-border/60 bg-card p-8">
          <Building2 className="h-12 w-12 text-muted-foreground" />
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
    <div className="flex h-full w-full flex-col overflow-y-auto bg-background">
      <div className="mx-auto w-full max-w-4xl space-y-6 p-4 sm:p-6">
        {/* Header */}
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
              <ScanLine className="h-5 w-5 text-primary" />
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
                <Clock className="h-4 w-4 text-muted-foreground" />
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
                        className="h-7 w-7 p-0"
                      >
                        <Link href={`/objects/${item.objectId}`}>
                          <ExternalLink className="h-3.5 w-3.5" />
                        </Link>
                      </Button>
                    )}
                    {!item.found && (
                      <div className="flex h-7 w-7 items-center justify-center">
                        <AlertCircle className="h-3.5 w-3.5 text-destructive" />
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
              <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg bg-primary/10">
                <Camera className="h-4 w-4 text-primary" />
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
              <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg bg-primary/10">
                <ScanLine className="h-4 w-4 text-primary" />
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
