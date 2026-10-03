"use client";

import { Button } from "@v1/ui/button";
import { X } from "lucide-react";
import {
  type FieldMapping,
  ImportFieldMapper,
} from "@/components/import-field-mapper";
import { useI18n } from "@/locales/client";
import { type ImportState, TARGET_FIELDS } from "../import-accessions-types";

interface ImportAccessionsMappingStepProps {
  state: ImportState;
  t: (key: string) => string;
  onReset: () => void;
  onSaveMappings: (mappings: FieldMapping[]) => void;
}

export function ImportAccessionsMappingStep({
  state,
  t,
  onReset,
  onSaveMappings,
}: ImportAccessionsMappingStepProps) {
  const tRoot = useI18n();
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold">
            {tRoot("untranslatedRecords.collections.import.mapFields")}
          </h2>
          <p className="text-sm text-muted-foreground">
            {tRoot("untranslatedRecords.collections.import.rowsFromFile", {
              count: state.rawData.length,
              filename: state.file?.name ?? "",
            })}
          </p>
        </div>
        <Button variant="outline" onClick={onReset}>
          <X className="mr-2 size-4" />
          {t("import.cancel")}
        </Button>
      </div>

      <ImportFieldMapper
        sourceFields={state.sourceFields}
        targetFields={TARGET_FIELDS.map((field) => ({
          ...field,
          label: tRoot(field.label),
          description: tRoot(field.description),
        }))}
        onSave={onSaveMappings}
      />
    </div>
  );
}
