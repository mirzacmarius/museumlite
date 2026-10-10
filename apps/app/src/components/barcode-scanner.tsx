"use client";

import { Button } from "@v1/ui/button";
import { cn } from "@v1/ui/utils";
import type { Html5Qrcode } from "html5-qrcode";
import {
  AlertCircle,
  Camera,
  CameraOff,
  CheckCircle2,
  Flashlight,
  FlashlightOff,
  Loader2,
} from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { useI18n } from "@/locales/client";

interface BarcodeScannerProps {
  onScanSuccess: (decodedText: string, format: string) => void;
  onScanError?: (error: string) => void;
  disabled?: boolean;
  className?: string;
  fps?: number;
  qrbox?: number;
  aspectRatio?: number;
}

type ScannerStatus =
  | "idle"
  | "initializing"
  | "scanning"
  | "success"
  | "error"
  | "permission-denied";

const LABELS = "untranslatedComponents.labels";

export function BarcodeScanner({
  onScanSuccess,
  onScanError,
  disabled = false,
  className,
  fps = 10,
  qrbox = 250,
  aspectRatio = 1.0,
}: BarcodeScannerProps) {
  const translate = useI18n();
  const [status, setStatus] = useState<ScannerStatus>("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [flashEnabled, setFlashEnabled] = useState(false);
  const scannerRef = useRef<HTMLDivElement>(null);
  const html5QrCodeRef = useRef<Html5Qrcode | null>(null);
  const isCleaningUpRef = useRef(false);
  const lastScannedCodeRef = useRef<string | null>(null);

  const stopScanner = useCallback(async () => {
    if (html5QrCodeRef.current && !isCleaningUpRef.current) {
      isCleaningUpRef.current = true;
      try {
        const state = await html5QrCodeRef.current.getState();
        if (state === 2) {
          await html5QrCodeRef.current.stop();
        }
      } catch (_error) {
        // Silently handle stop errors
      } finally {
        isCleaningUpRef.current = false;
      }
    }
  }, []);

  const toggleFlash = useCallback(async () => {
    if (!html5QrCodeRef.current) return;

    try {
      type TorchConstraintSet = MediaTrackConstraintSet & { torch?: boolean };
      const constraintSet: TorchConstraintSet = {};
      Object.assign(constraintSet, { torch: !flashEnabled });

      await html5QrCodeRef.current.applyVideoConstraints({
        advanced: [constraintSet],
      });

      setFlashEnabled(!flashEnabled);
    } catch {
      setErrorMessage(translate(`${LABELS}.flashNotSupported`));
    }
  }, [flashEnabled, translate]);

  const startScanner = useCallback(async () => {
    if (disabled || status === "scanning" || isCleaningUpRef.current) return;

    setStatus("initializing");
    setErrorMessage(null);

    try {
      const { Html5Qrcode } = await import("html5-qrcode");
      const scanner = new Html5Qrcode("barcode-scanner-region");
      html5QrCodeRef.current = scanner;

      const config = {
        fps,
        qrbox,
        aspectRatio,
        formatsToSupport: [
          1, // QR_CODE
          8, // CODE_128
          2, // CODE_39
        ],
      };

      await scanner.start(
        { facingMode: "environment" },
        config,
        (decodedText, decodedResult) => {
          if (decodedText && decodedText !== lastScannedCodeRef.current) {
            lastScannedCodeRef.current = decodedText;
            setStatus("success");
            const format = decodedResult.result.format?.formatName || "UNKNOWN";
            onScanSuccess(decodedText, format);

            setTimeout(() => {
              setStatus("scanning");
              lastScannedCodeRef.current = null;
            }, 2000);
          }
        },
        (_errorMsg) => {
          // Silent scanning errors are normal when no code is in view
        },
      );

      setStatus("scanning");
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);

      if (errorMsg.includes("Permission") || errorMsg.includes("NotAllowed")) {
        setStatus("permission-denied");
        setErrorMessage(
          translate(
            "untranslatedComponents.labels.cameraPermissionDeniedEnableBrowserAccess",
          ),
        );
      } else {
        setStatus("error");
        setErrorMessage(translate(`${LABELS}.failedToStartScanner`));
      }

      if (onScanError) {
        onScanError(errorMsg);
      }
    }
  }, [disabled, status, fps, qrbox, aspectRatio, onScanSuccess, onScanError]);

  useEffect(() => {
    return () => {
      stopScanner();
    };
  }, [stopScanner]);

  const handleStart = useCallback(() => {
    if (status === "idle" || status === "error") {
      startScanner();
    }
  }, [status, startScanner]);

  const handleStop = useCallback(() => {
    if (status === "scanning" || status === "success") {
      stopScanner();
      setStatus("idle");
      setFlashEnabled(false);
    }
  }, [status, stopScanner]);

  const showControls =
    status === "scanning" || status === "success" || status === "initializing";
  const canToggleFlash = status === "scanning" || status === "success";

  return (
    <div className={cn("space-y-4", className)}>
      <div
        className={cn(
          "relative flex min-h-[300px] flex-col items-center justify-center overflow-hidden rounded-lg border-2",
          status === "scanning" || status === "success"
            ? "border-primary"
            : "border-border",
          status === "success" && "border-green-500",
          status === "error" && "border-destructive",
          status === "permission-denied" && "border-yellow-500",
        )}
      >
        <div
          id="barcode-scanner-region"
          ref={scannerRef}
          className={cn(
            "w-full",
            (status === "idle" ||
              status === "error" ||
              status === "permission-denied") &&
              "hidden",
          )}
        />

        {status === "idle" && (
          <div className="flex flex-col items-center justify-center p-8 text-center">
            <Camera className="mb-4 size-12 text-muted-foreground" />
            <p className="mb-2 text-sm font-medium text-foreground">
              {translate("untranslatedComponents.labels.readyToScan")}
            </p>
            <p className="mb-4 text-xs text-muted-foreground">
              {translate(
                "untranslatedComponents.labels.clickStartToActivateYourCameraAndScanBarcodesOrQRCodes",
              )}
            </p>
            <Button onClick={handleStart} disabled={disabled}>
              <Camera className="size-4" />
              {translate("untranslatedComponents.labels.startScanner")}
            </Button>
          </div>
        )}

        {status === "initializing" && (
          <div className="flex flex-col items-center justify-center p-8">
            <Loader2 className="mb-4 size-12 animate-spin text-primary" />
            <p className="text-sm font-medium text-foreground">
              {translate("untranslatedComponents.labels.initializingCamera")}
            </p>
          </div>
        )}

        {status === "permission-denied" && (
          <div className="flex flex-col items-center justify-center p-8 text-center">
            <CameraOff className="mb-4 size-12 text-yellow-500" />
            <p className="mb-2 text-sm font-medium text-foreground">
              {translate("untranslatedComponents.labels.cameraAccessRequired")}
            </p>
            <p className="mb-4 text-xs text-muted-foreground">
              {translate(
                "untranslatedComponents.labels.pleaseEnableCameraPermissionsInYourBrowserSettingsAndTryAgain",
              )}
            </p>
          </div>
        )}

        {status === "error" && errorMessage && (
          <div className="flex flex-col items-center justify-center p-8 text-center">
            <AlertCircle className="mb-4 size-12 text-destructive" />
            <p className="mb-2 text-sm font-medium text-foreground">
              {translate("untranslatedComponents.labels.scannerError")}
            </p>
            <p className="mb-4 text-xs text-muted-foreground">{errorMessage}</p>
            <Button onClick={handleStart} variant="outline">
              <Camera className="size-4" />
              {translate("untranslatedComponents.labels.tryAgain")}
            </Button>
          </div>
        )}

        {status === "success" && (
          <div className="absolute inset-0 flex items-center justify-center bg-green-500/10">
            <div className="flex flex-col items-center rounded-lg bg-background/90 p-6 shadow-lg">
              <CheckCircle2 className="mb-2 size-12 text-green-500" />
              <p className="text-sm font-medium text-foreground">
                {translate(
                  "untranslatedComponents.labels.codeScannedSuccessfully",
                )}
              </p>
            </div>
          </div>
        )}
      </div>

      {errorMessage && status !== "error" && status !== "permission-denied" && (
        <div className="flex items-center gap-2 rounded-md bg-destructive/10 px-3 py-2 text-xs text-destructive">
          <AlertCircle className="size-3.5 flex-shrink-0" />
          <span>{errorMessage}</span>
        </div>
      )}

      {showControls && (
        <div className="flex items-center justify-center gap-3">
          <Button
            onClick={toggleFlash}
            variant="outline"
            size="icon"
            disabled={!canToggleFlash}
            title={
              flashEnabled
                ? translate("untranslatedComponents.labels.turnOffFlash")
                : translate("untranslatedComponents.labels.turnOnFlash")
            }
          >
            {flashEnabled ? (
              <FlashlightOff className="size-4" />
            ) : (
              <Flashlight className="size-4" />
            )}
          </Button>

          <Button
            onClick={handleStop}
            variant="destructive"
            disabled={status === "initializing"}
          >
            <CameraOff className="size-4" />
            {translate("untranslatedComponents.labels.stopScanner")}
          </Button>
        </div>
      )}

      <div className="space-y-1 rounded-md border border-border bg-muted/30 p-3">
        <p className="text-xs font-medium text-foreground">
          {translate("untranslatedComponents.labels.supportedFormats")}
        </p>
        <div className="flex flex-wrap gap-2">
          <span className="rounded-md bg-background px-2 py-1 text-xs text-muted-foreground">
            {translate("untranslatedComponents.labels.qRCode")}
          </span>
          <span className="rounded-md bg-background px-2 py-1 text-xs text-muted-foreground">
            {translate("untranslatedComponents.labels.code128")}
          </span>
          <span className="rounded-md bg-background px-2 py-1 text-xs text-muted-foreground">
            {translate("untranslatedComponents.labels.code39")}
          </span>
        </div>
        <p className="pt-2 text-xs text-muted-foreground">
          {translate(
            "untranslatedComponents.labels.positionTheCodeWithinTheCameraViewToScan",
          )}
        </p>
      </div>
    </div>
  );
}
