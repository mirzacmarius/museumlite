"use client";

import { useCallback } from "react";
import { useScopedI18n } from "@/locales/client";
import type { ParseError } from "../../import/import-csv";

export function useTranslatedParseError() {
  const t = useScopedI18n("locations.importErrors");

  return useCallback(
    (error: ParseError): string => {
      const rowPrefix = error.row ? `Row ${error.row}: ` : "";
      switch (error.type) {
        case "csvMustHaveRows":
          return t("csvMustHaveRows");
        case "missingHeaderRow":
          return t("missingHeaderRow");
        case "missingRequiredColumns":
          return t("missingRequiredColumns", { columns: error.columns ?? "" });
        case "nameRequired":
          return `${rowPrefix}${t("nameRequired")}`;
        case "locationCodeRequired":
          return `${rowPrefix}${t("locationCodeRequired")}`;
        case "typeRequired":
          return `${rowPrefix}${t("typeRequired")}`;
        default:
          return "Unknown error";
      }
    },
    [t],
  );
}
