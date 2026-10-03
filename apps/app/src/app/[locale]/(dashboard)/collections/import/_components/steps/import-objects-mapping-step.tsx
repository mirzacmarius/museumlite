"use client";

import { Button } from "@v1/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@v1/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@v1/ui/select";
import { X } from "lucide-react";
import {
  type FieldMapping,
  ImportFieldMapper,
} from "@/components/import-field-mapper";
import { useI18n } from "@/locales/client";
import {
  IMPORT_TEMPLATES,
  type ImportState,
  TARGET_FIELDS,
} from "../import-objects-types";

interface ImportObjectsMappingStepProps {
  state: ImportState;
  common: (key: string) => string;
  onReset: () => void;
  onTemplateSelect: (templateId: string) => void;
  getInitialMappings: () => FieldMapping[] | undefined;
  onSaveMappings: (mappings: FieldMapping[]) => void;
}

export function ImportObjectsMappingStep({
  state,
  common,
  onReset,
  onTemplateSelect,
  getInitialMappings,
  onSaveMappings,
}: ImportObjectsMappingStepProps) {
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
          {common("cancel")}
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>
            {tRoot("untranslatedRecords.collections.import.legacyTemplate")}
          </CardTitle>
          <CardDescription>
            {tRoot(
              "untranslatedRecords.collections.import.legacyTemplateDescription",
            )}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-4">
            <div className="flex-1">
              <Select
                value={state.selectedTemplate || ""}
                onValueChange={onTemplateSelect}
              >
                <SelectTrigger>
                  <SelectValue
                    placeholder={tRoot(
                      "untranslatedRecords.collections.import.templatePlaceholder",
                    )}
                  />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">
                    <span className="text-muted-foreground">
                      {tRoot(
                        "untranslatedRecords.collections.import.noTemplate",
                      )}
                    </span>
                  </SelectItem>
                  {IMPORT_TEMPLATES.map((template) => (
                    <SelectItem key={template.id} value={template.id}>
                      <div className="flex flex-col">
                        <span className="font-medium">{template.name}</span>
                        <span className="text-xs text-muted-foreground">
                          {tRoot(
                            template.id === "pastperfect"
                              ? "untranslatedRecords.collections.import.templates.pastperfectDescription"
                              : "untranslatedRecords.collections.import.templates.tmsDescription",
                          )}
                        </span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {state.selectedTemplate ? (
              <Button
                variant="outline"
                size="sm"
                onClick={() => onTemplateSelect("")}
              >
                <X className="mr-2 size-4" />
                {tRoot("untranslatedRecords.collections.import.clearTemplate")}
              </Button>
            ) : null}
          </div>
        </CardContent>
      </Card>

      <ImportFieldMapper
        key={state.selectedTemplate || "manual"}
        sourceFields={state.sourceFields}
        targetFields={TARGET_FIELDS.map((field) => ({
          ...field,
          label: tRoot(field.label),
          description: tRoot(field.description),
        }))}
        initialMappings={getInitialMappings()}
        onSave={onSaveMappings}
      />
    </div>
  );
}
