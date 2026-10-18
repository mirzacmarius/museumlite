import {
  type AccessionFormatIssue,
  accessionFormatErrorFromError,
} from "@v1/backend/convex/utils/accessionNumberParser";
import { useScopedI18n } from "@/locales/client";

/**
 * Translates why an accession number format cannot number objects, from the
 * validation query's issues or a refused save. Server text is never shown;
 * both return null when there is nothing to explain.
 */
export function useAccessionFormatErrorMessage() {
  const t = useScopedI18n("settings.organization.formatErrors");

  function issuesMessage(
    issues: readonly AccessionFormatIssue[],
  ): string | null {
    const sentences: string[] = [];
    if (issues.some((issue) => issue.code === "FORMAT_EMPTY")) {
      sentences.push(t("empty"));
    }
    const unknown = issues.find((issue) => issue.code === "UNKNOWN_VARIABLE");
    if (unknown) {
      sentences.push(t("unknownVariable", { variable: unknown.variable }));
    }
    if (issues.some((issue) => issue.code === "COUNTER_MISSING")) {
      sentences.push(t("counterMissing", { example: "{####}" }));
    }
    return sentences.length > 0 ? sentences.join(" ") : null;
  }

  function errorMessage(error: unknown): string | null {
    const refusal = accessionFormatErrorFromError(error);
    return refusal ? issuesMessage(refusal.issues) : null;
  }

  return { issuesMessage, errorMessage };
}
