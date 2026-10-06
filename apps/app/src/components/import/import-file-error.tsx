import { AlertCircle } from "lucide-react";

/** Explains why a chosen file could not be read. */
export function ImportFileError({ errors }: { errors: string[] }) {
  if (errors.length === 0) return null;
  return (
    <div
      role="alert"
      className="mb-4 flex items-start gap-2 rounded-lg border border-destructive bg-destructive/10 p-4 text-sm text-destructive"
    >
      <AlertCircle className="mt-0.5 size-4 shrink-0" />
      <span>{errors.join(" ")}</span>
    </div>
  );
}
