"use client";

import { MEASUREMENT_SETS_MAX } from "@v1/backend/convex/utils/objectDescription";
import { Button } from "@v1/ui/button";
import { Input } from "@v1/ui/input";
import { Label } from "@v1/ui/label";
import { Plus, Trash2 } from "lucide-react";
import {
  FieldError,
  fieldErrorProps,
} from "@/components/record-form/record-form-notices";
import { useI18n, useScopedI18n } from "@/locales/client";
import {
  EMPTY_MEASUREMENT_SET_ENTRY,
  measurementSetEntryProblem,
} from "./measurement-sets";
import { MeasuredPartSelect } from "./object-description-fields";
import {
  type CollectionFormTabProps,
  type MeasurementSetEntry,
  NO_FIELD_ERRORS,
} from "./types";
import { withMeasurementSetLocalIds } from "./utils";

/**
 * Measurements of parts other than the main set's, such as the frame or the
 * base: one row per part, added and removed like inscription marks.
 */
export function MeasurementSetsField({
  formData,
  updateField,
  fieldErrors = NO_FIELD_ERRORS,
}: Pick<CollectionFormTabProps, "formData" | "updateField" | "fieldErrors">) {
  const t = useScopedI18n("recordForm.objectFields");
  // Rows carry the ids the form gave them when the values were loaded.
  const sets = formData.measurementSets ?? [];
  const setSets = (next: MeasurementSetEntry[]) =>
    updateField("measurementSets", next);
  const error = fieldErrors.measurementSets;
  return (
    <div className="space-y-3 md:col-span-2 xl:col-span-3">
      <div className="space-y-1">
        <h3
          className="text-sm font-medium text-foreground"
          id="measurementSets"
          tabIndex={-1}
        >
          {t("measurementSets")}
        </h3>
        <p className="text-sm text-muted-foreground">
          {t("measurementSetsHint")}
        </p>
      </div>
      {sets.map((entry, index) => (
        <MeasurementSetRow
          key={entry.localId ?? `measurement-set-${index}`}
          index={index}
          entry={entry}
          error={measurementSetEntryProblem(entry) ? error : undefined}
          onChange={(next) =>
            setSets(
              sets.map((item, itemIndex) =>
                itemIndex === index ? next : item,
              ),
            )
          }
          onRemove={() =>
            setSets(sets.filter((_, itemIndex) => itemIndex !== index))
          }
        />
      ))}
      <FieldError field="measurementSets" message={error} />
      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={sets.length >= MEASUREMENT_SETS_MAX}
        onClick={() =>
          setSets(
            withMeasurementSetLocalIds([...sets, EMPTY_MEASUREMENT_SET_ENTRY]),
          )
        }
      >
        <Plus className="mr-2 size-4" />
        {t("addMeasurementSet")}
      </Button>
    </div>
  );
}

function MeasurementSetRow({
  index,
  entry,
  error,
  onChange,
  onRemove,
}: {
  index: number;
  entry: MeasurementSetEntry;
  /** The list's error, when this row is one it is about. */
  error: string | undefined;
  onChange: (entry: MeasurementSetEntry) => void;
  onRemove: () => void;
}) {
  const tRoot = useI18n();
  const t = useScopedI18n("recordForm.objectFields");
  const id = (field: string) => `measurement-set-${field}-${index}`;
  const invalidProps = fieldErrorProps("measurementSets", error);
  const inputs = [
    { field: "height", label: t("height"), isNumber: true },
    { field: "width", label: t("width"), isNumber: true },
    { field: "depth", label: t("depth"), isNumber: true },
    {
      field: "diameter",
      label: tRoot("objects.printView.diameter"),
      isNumber: true,
    },
    { field: "unit", label: t("dimensionUnit"), isNumber: false },
    {
      field: "weight",
      label: tRoot("objects.printView.weight"),
      isNumber: true,
    },
    { field: "weightUnit", label: t("weightUnit"), isNumber: false },
  ] as const;
  return (
    <div className="space-y-3 rounded-xl border border-border/50 p-4">
      <div className="grid gap-3 sm:grid-cols-[minmax(0,14rem)_minmax(0,1fr)_auto] sm:items-end">
        <div className="space-y-2">
          <Label htmlFor={id("part")}>{t("measuredPart")}</Label>
          <MeasuredPartSelect
            id={id("part")}
            value={entry.part}
            onValueChange={(part) => onChange({ ...entry, part })}
            optional={false}
            invalidProps={invalidProps}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor={id("partNote")}>{t("partNote")}</Label>
          <Input
            id={id("partNote")}
            value={entry.partNote}
            onChange={(event) =>
              onChange({ ...entry, partNote: event.target.value })
            }
          />
        </div>
        <Button
          type="button"
          variant="outline"
          size="icon"
          aria-label={t("removeMeasurementSet")}
          onClick={onRemove}
        >
          <Trash2 className="size-4" />
        </Button>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-4 xl:grid-cols-7">
        {inputs.map(({ field, label, isNumber }) => (
          <div key={field} className="space-y-2">
            <Label htmlFor={id(field)}>{label}</Label>
            <Input
              id={id(field)}
              inputMode={isNumber ? "decimal" : undefined}
              value={entry[field]}
              onChange={(event) =>
                onChange({ ...entry, [field]: event.target.value })
              }
              {...(isNumber ? invalidProps : {})}
            />
          </div>
        ))}
      </div>
    </div>
  );
}
