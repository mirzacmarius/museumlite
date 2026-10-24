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
import { ArrowRight, Save, X } from "lucide-react";
import { useCallback, useState } from "react";
import { useI18n } from "@/locales/client";

// Radix Select reserves the empty string for "no selection".
const DO_NOT_IMPORT = "__do_not_import__";

export interface FieldMapping {
  sourceField: string;
  targetField: string | null;
}

interface TargetField {
  id: string;
  label: string;
  required: boolean;
  description?: string;
}

interface ImportFieldMapperProps {
  sourceFields: string[];
  targetFields: TargetField[];
  initialMappings?: FieldMapping[];
  onMappingsChange?: (mappings: FieldMapping[]) => void;
  onSave?: (mappings: FieldMapping[]) => void;
}

const EMPTY_FIELD_MAPPINGS: FieldMapping[] = [];

export function ImportFieldMapper({
  sourceFields,
  targetFields,
  initialMappings = EMPTY_FIELD_MAPPINGS,
  onMappingsChange,
  onSave,
}: ImportFieldMapperProps) {
  const translate = useI18n();
  const [mappings, setMappings] = useState<FieldMapping[]>(() => {
    if (initialMappings.length > 0) {
      return initialMappings;
    }

    return sourceFields.map((sourceField) => {
      const matchingTarget = targetFields.find(
        (target) =>
          target.id.toLowerCase() === sourceField.toLowerCase() ||
          target.label.toLowerCase() === sourceField.toLowerCase(),
      );

      return {
        sourceField,
        targetField: matchingTarget?.id || null,
      };
    });
  });

  const handleMappingChange = useCallback(
    (sourceField: string, targetField: string | null) => {
      const newMappings = mappings.map((mapping) =>
        mapping.sourceField === sourceField
          ? { ...mapping, targetField }
          : mapping,
      );
      setMappings(newMappings);
      onMappingsChange?.(newMappings);
    },
    [mappings, onMappingsChange],
  );

  const handleClearMapping = useCallback(
    (sourceField: string) => {
      handleMappingChange(sourceField, null);
    },
    [handleMappingChange],
  );

  const handleSave = useCallback(() => {
    onSave?.(mappings);
  }, [mappings, onSave]);

  const getUsedTargetFields = useCallback(() => {
    return new Set(
      mappings.flatMap((m) => (m.targetField === null ? [] : [m.targetField])),
    );
  }, [mappings]);

  const getMappingForSource = useCallback(
    (sourceField: string) => {
      return mappings.find((m) => m.sourceField === sourceField);
    },
    [mappings],
  );

  const getUnmappedRequiredFields = useCallback(() => {
    const usedTargetFields = getUsedTargetFields();
    return targetFields.filter(
      (field) => field.required && !usedTargetFields.has(field.id),
    );
  }, [targetFields, getUsedTargetFields]);

  const unmappedRequired = getUnmappedRequiredFields();

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>
              {translate("untranslatedComponents.labels.fieldMapping")}
            </CardTitle>
            <CardDescription>
              {translate(
                "untranslatedComponents.labels.mapYourSourceFieldsToTheTargetDatabaseFields",
              )}
            </CardDescription>
          </div>
          {onSave && (
            <Button
              onClick={handleSave}
              disabled={unmappedRequired.length > 0}
              className="bg-primary hover:bg-primary/90"
            >
              <Save className="mr-2 size-4" />
              {translate("untranslatedComponents.labels.saveMappings")}
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {unmappedRequired.length > 0 && (
          <div className="mb-4 rounded-lg border border-destructive bg-destructive/10 p-4">
            <p className="text-sm font-medium text-destructive">
              {translate(
                "untranslatedComponents.labels.requiredFieldsNotMapped",
              )}
            </p>
            <ul className="mt-2 list-inside list-disc text-sm text-destructive">
              {unmappedRequired.map((field) => (
                <li key={field.id}>{field.label}</li>
              ))}
            </ul>
          </div>
        )}

        <div className="space-y-3">
          {sourceFields.map((sourceField) => {
            const mapping = getMappingForSource(sourceField);
            const usedTargetFields = getUsedTargetFields();
            const mappedDescription = targetFields.find(
              (field) => field.id === mapping?.targetField,
            )?.description;

            return (
              <div
                key={sourceField}
                className="flex items-center gap-4 rounded-lg border border-border p-4"
              >
                <div className="flex-1">
                  <p className="text-sm font-medium">{sourceField}</p>
                  <p className="text-xs text-muted-foreground">
                    {translate("untranslatedComponents.labels.sourceField")}
                  </p>
                </div>

                <ArrowRight className="size-4 text-muted-foreground" />

                <div className="flex-1 space-y-1">
                  <div className="flex items-center gap-2">
                    <Select
                      value={mapping?.targetField || DO_NOT_IMPORT}
                      onValueChange={(value) =>
                        handleMappingChange(
                          sourceField,
                          value === DO_NOT_IMPORT ? null : value,
                        )
                      }
                    >
                      <SelectTrigger>
                        <SelectValue
                          placeholder={translate(
                            "untranslatedComponents.labels.selectTargetField",
                          )}
                        />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value={DO_NOT_IMPORT}>
                          <span className="text-muted-foreground">
                            {translate(
                              "untranslatedComponents.labels.doNotImport",
                            )}
                          </span>
                        </SelectItem>
                        {targetFields.map((field) => {
                          const isUsed =
                            usedTargetFields.has(field.id) &&
                            mapping?.targetField !== field.id;

                          return (
                            <SelectItem
                              key={field.id}
                              value={field.id}
                              disabled={isUsed}
                            >
                              <div className="flex items-center gap-2">
                                <span>
                                  {field.label}
                                  {field.required && (
                                    <span className="ml-1 text-destructive">
                                      *
                                    </span>
                                  )}
                                </span>
                                {isUsed && (
                                  <span className="text-xs text-muted-foreground">
                                    {translate(
                                      "untranslatedComponents.labels.alreadyMapped",
                                    )}
                                  </span>
                                )}
                              </div>
                            </SelectItem>
                          );
                        })}
                      </SelectContent>
                    </Select>

                    {mapping?.targetField && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleClearMapping(sourceField)}
                      >
                        <X className="size-4" />
                      </Button>
                    )}
                  </div>
                  {mappedDescription ? (
                    <p className="text-xs text-muted-foreground">
                      {mappedDescription}
                    </p>
                  ) : null}
                </div>
              </div>
            );
          })}
        </div>

        {sourceFields.length === 0 && (
          <div className="py-8 text-center text-sm text-muted-foreground">
            {translate(
              "untranslatedComponents.labels.noSourceFieldsAvailableUploadAFileToSeeFieldMappings",
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
