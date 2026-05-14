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

export function ImportFieldMapper({
  sourceFields,
  targetFields,
  initialMappings = [],
  onMappingsChange,
  onSave,
}: ImportFieldMapperProps) {
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
      mappings.map((m) => m.targetField).filter((t): t is string => t !== null),
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
            <CardTitle>Field Mapping</CardTitle>
            <CardDescription>
              Map your source fields to the target database fields
            </CardDescription>
          </div>
          {onSave && (
            <Button
              onClick={handleSave}
              disabled={unmappedRequired.length > 0}
              className="bg-indigo-600 hover:bg-indigo-500"
            >
              <Save className="mr-2 size-4" />
              Save Mappings
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {unmappedRequired.length > 0 && (
          <div className="mb-4 rounded-lg border border-destructive bg-destructive/10 p-4">
            <p className="text-sm font-medium text-destructive">
              Required fields not mapped:
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

            return (
              <div
                key={sourceField}
                className="flex items-center gap-4 rounded-lg border border-border p-4"
              >
                <div className="flex-1">
                  <p className="text-sm font-medium">{sourceField}</p>
                  <p className="text-xs text-muted-foreground">Source field</p>
                </div>

                <ArrowRight className="size-4 text-muted-foreground" />

                <div className="flex flex-1 items-center gap-2">
                  <Select
                    value={mapping?.targetField || ""}
                    onValueChange={(value) =>
                      handleMappingChange(
                        sourceField,
                        value === "" ? null : value,
                      )
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select target field..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="">
                        <span className="text-muted-foreground">
                          Do not import
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
                                  (already mapped)
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
              </div>
            );
          })}
        </div>

        {sourceFields.length === 0 && (
          <div className="py-8 text-center text-sm text-muted-foreground">
            No source fields available. Upload a file to see field mappings.
          </div>
        )}
      </CardContent>
    </Card>
  );
}
