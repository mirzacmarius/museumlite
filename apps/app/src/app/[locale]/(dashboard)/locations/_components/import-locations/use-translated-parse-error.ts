"use client";

import { useCallback } from "react";
import { useCsvFileProblemMessage } from "@/hooks/use-csv-file-problem-message";
import { useScopedI18n } from "@/locales/client";
import type { ParseError } from "../../import/import-csv";

export function useTranslatedParseError() {
  const t = useScopedI18n("locations.importErrors");
  const csvMessage = useCsvFileProblemMessage();

  return useCallback(
    (error: ParseError): string => {
      const rowPrefix = error.row ? `Row ${error.row}: ` : "";
      switch (error.type) {
        case "csvMustHaveRows":
          return t("csvMustHaveRows");
        case "tooManyRows":
          return t("tooManyRows", { max: error.columns ?? "" });
        case "unreadableFile":
          return error.line === undefined
            ? t("unreadableFile")
            : (csvMessage({ code: "unclosedQuote", line: error.line }) ??
                t("unreadableFile"));
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
    [csvMessage, t],
  );
}
