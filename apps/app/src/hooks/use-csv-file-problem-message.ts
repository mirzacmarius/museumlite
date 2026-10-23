import { CsvFileError, type CsvFileProblem } from "@/lib/csv-parser";
import { useScopedI18n } from "@/locales/client";

/**
 * Explains in the app's language why a CSV file can't be imported. Pass a
 * problem, or a thrown error: anything but a {@link CsvFileError} gives null
 * so callers keep their own handling.
 */
export function useCsvFileProblemMessage() {
  const t = useScopedI18n("trackedImport.csvProblems");
  return (problemOrError: CsvFileProblem | unknown): string | null => {
    const problem =
      problemOrError instanceof CsvFileError
        ? problemOrError.problem
        : isCsvFileProblem(problemOrError)
          ? problemOrError
          : null;
    switch (problem?.code) {
      case "empty":
        return t("noDataRows");
      case "unclosedQuote":
        return t("unclosedQuote", { row: problem.line });
      case "tooManyRows":
        return t("tooManyRows", { rows: problem.rows, max: problem.max });
      case undefined:
        return null;
    }
  };
}

function isCsvFileProblem(value: unknown): value is CsvFileProblem {
  return (
    typeof value === "object" &&
    value !== null &&
    "code" in value &&
    (value.code === "empty" ||
      value.code === "unclosedQuote" ||
      value.code === "tooManyRows")
  );
}
