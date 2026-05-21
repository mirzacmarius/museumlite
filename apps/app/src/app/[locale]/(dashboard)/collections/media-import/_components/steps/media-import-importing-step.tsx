"use client";

import { Loader2 } from "lucide-react";
import type { MediaImportState } from "../media-import-types";

interface MediaImportImportingStepProps {
  state: MediaImportState;
  t: (key: string) => string;
}

export function MediaImportImportingStep({
  state,
  t,
}: MediaImportImportingStepProps) {
  return (
    <div className="mx-auto max-w-md text-center pt-12">
      <Loader2 className="mx-auto mb-6 size-12 animate-spin text-primary" />
      <h2 className="text-xl font-semibold mb-2">
        {t("mediaImport.importing")}
      </h2>
      <p className="text-muted-foreground mb-6">
        Uploading {state.currentFileIndex + 1} of {state.mediaFiles.length}
      </p>
      <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
        <div
          className="h-full bg-primary transition-all duration-300"
          style={{
            width: `${(state.currentFileIndex / state.mediaFiles.length) * 100}%`,
          }}
        />
      </div>
      <div className="mt-8 text-sm text-muted-foreground">
        Do not close this window until the import is complete.
      </div>
    </div>
  );
}
