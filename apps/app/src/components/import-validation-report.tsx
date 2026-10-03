"use client";

import { AlertCircle, AlertTriangle, Info } from "lucide-react";
import { getImportValidationCopy } from "@/lib/import-validation-copy";
import { useI18n } from "@/locales/client";

export interface ValidationError {
  severity: "error" | "warning" | "info";
  message: string;
  rowNumber?: number;
}

interface ImportValidationReportProps {
  errors: ValidationError[];
  maxDisplay?: number;
}

export function ImportValidationReport({
  errors,
  maxDisplay = 10,
}: ImportValidationReportProps) {
  const translate = useI18n();
  if (errors.length === 0) {
    return null;
  }

  const errorsByType = {
    error: errors.filter((e) => e.severity === "error"),
    warning: errors.filter((e) => e.severity === "warning"),
    info: errors.filter((e) => e.severity === "info"),
  };

  return (
    <div className="space-y-4">
      {errorsByType.error.length > 0 && (
        <div className="rounded-lg border border-destructive bg-destructive/10 p-4">
          <div className="flex items-center gap-2 text-destructive">
            <AlertCircle className="size-4" />
            <span className="font-medium">
              {errorsByType.error.length}{" "}
              {translate("untranslatedComponents.labels.validation")}{" "}
              {errorsByType.error.length === 1
                ? translate("untranslatedComponents.validation.error")
                : translate("untranslatedComponents.validation.errors")}
            </span>
          </div>
          <ul className="mt-2 space-y-1 text-sm text-destructive">
            {errorsByType.error.slice(0, maxDisplay).map((error) => (
              <li
                key={`${error.severity}-${error.rowNumber ?? "na"}-${error.message}`}
                className="flex items-start gap-2"
              >
                {error.rowNumber && (
                  <span className="font-mono text-xs opacity-70">
                    {translate("untranslatedComponents.labels.row")}{" "}
                    {error.rowNumber}:
                  </span>
                )}
                <span>{getImportValidationCopy(error.message, translate)}</span>
              </li>
            ))}
            {errorsByType.error.length > maxDisplay && (
              <li className="text-destructive/70">
                {translate("untranslatedComponents.labels.and")}{" "}
                {errorsByType.error.length - maxDisplay}{" "}
                {translate("untranslatedComponents.labels.more")}
              </li>
            )}
          </ul>
        </div>
      )}

      {errorsByType.warning.length > 0 && (
        <div className="rounded-lg border border-amber-500/50 bg-amber-500/10 p-4">
          <div className="flex items-center gap-2 text-amber-600">
            <AlertTriangle className="size-4" />
            <span className="font-medium">
              {errorsByType.warning.length}{" "}
              {errorsByType.warning.length === 1
                ? translate("untranslatedComponents.validation.warning")
                : translate("untranslatedComponents.validation.warnings")}
            </span>
          </div>
          <ul className="mt-2 space-y-1 text-sm text-amber-600">
            {errorsByType.warning.slice(0, maxDisplay).map((error) => (
              <li
                key={`${error.severity}-${error.rowNumber ?? "na"}-${error.message}`}
                className="flex items-start gap-2"
              >
                {error.rowNumber && (
                  <span className="font-mono text-xs opacity-70">
                    {translate("untranslatedComponents.labels.row")}{" "}
                    {error.rowNumber}:
                  </span>
                )}
                <span>{getImportValidationCopy(error.message, translate)}</span>
              </li>
            ))}
            {errorsByType.warning.length > maxDisplay && (
              <li className="text-amber-600/70">
                {translate("untranslatedComponents.labels.and")}{" "}
                {errorsByType.warning.length - maxDisplay}{" "}
                {translate("untranslatedComponents.labels.more")}
              </li>
            )}
          </ul>
        </div>
      )}

      {errorsByType.info.length > 0 && (
        <div className="rounded-lg border border-blue-500/50 bg-blue-500/10 p-4">
          <div className="flex items-center gap-2 text-blue-600">
            <Info className="size-4" />
            <span className="font-medium">
              {errorsByType.info.length}{" "}
              {errorsByType.info.length === 1
                ? translate(
                    "untranslatedComponents.validation.informationalMessage",
                  )
                : translate(
                    "untranslatedComponents.validation.informationalMessages",
                  )}
            </span>
          </div>
          <ul className="mt-2 space-y-1 text-sm text-blue-600">
            {errorsByType.info.slice(0, maxDisplay).map((error) => (
              <li
                key={`${error.severity}-${error.rowNumber ?? "na"}-${error.message}`}
                className="flex items-start gap-2"
              >
                {error.rowNumber && (
                  <span className="font-mono text-xs opacity-70">
                    {translate("untranslatedComponents.labels.row")}{" "}
                    {error.rowNumber}:
                  </span>
                )}
                <span>{getImportValidationCopy(error.message, translate)}</span>
              </li>
            ))}
            {errorsByType.info.length > maxDisplay && (
              <li className="text-blue-600/70">
                {translate("untranslatedComponents.labels.and")}{" "}
                {errorsByType.info.length - maxDisplay}{" "}
                {translate("untranslatedComponents.labels.more")}
              </li>
            )}
          </ul>
        </div>
      )}
    </div>
  );
}
