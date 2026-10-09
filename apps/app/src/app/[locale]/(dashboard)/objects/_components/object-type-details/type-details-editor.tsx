"use client";

import type { CollectionModuleId } from "@v1/backend/convex/utils/moduleCatalog";
import { Input } from "@v1/ui/input";
import { Label } from "@v1/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@v1/ui/select";
import { Textarea } from "@v1/ui/textarea";
import { RepeatableTextField } from "@/components/repeatable-text-field";
import type {
  TypeDetailFieldValue,
  TypeDetailFieldValues,
} from "./type-detail-values";
import {
  type TypeDetailFieldSpec,
  useTypeDetailFieldSpecs,
} from "./use-type-detail-field-specs";

const UNSET = "__unset__";

function toDateInputValue(timestamp: number) {
  const date = new Date(timestamp);
  return [
    String(date.getFullYear()).padStart(4, "0"),
    String(date.getMonth() + 1).padStart(2, "0"),
    String(date.getDate()).padStart(2, "0"),
  ].join("-");
}

/**
 * Local noon on the chosen day, as elsewhere in the app, so the date reads the
 * same in the staff member's time zone. `setFullYear` keeps years below 100.
 */
function fromDateInputValue(value: string) {
  const match = /^(\d{4,})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return undefined;
  const date = new Date(0);
  date.setFullYear(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  date.setHours(12, 0, 0, 0);
  return date.getTime();
}

interface TypeDetailFieldInputProps {
  id: string;
  spec: Exclude<TypeDetailFieldSpec, { kind: "list" }>;
  value: TypeDetailFieldValue | undefined;
  onChange: (value: TypeDetailFieldValue | undefined) => void;
  booleanLabels: { yes: string; no: string };
  notSpecifiedLabel: string;
}

function TypeDetailFieldInput({
  id,
  spec,
  value,
  onChange,
  booleanLabels,
  notSpecifiedLabel,
}: TypeDetailFieldInputProps) {
  switch (spec.kind) {
    case "text":
    case "url":
      return (
        <Input
          id={id}
          type={spec.kind}
          value={typeof value === "string" ? value : ""}
          onChange={(event) => onChange(event.target.value)}
        />
      );
    case "textarea":
      return (
        <Textarea
          id={id}
          value={typeof value === "string" ? value : ""}
          onChange={(event) => onChange(event.target.value)}
        />
      );
    case "number":
    case "year":
      return (
        <Input
          id={id}
          type="number"
          step={spec.kind === "year" ? 1 : "any"}
          // A numeric value keeps in-progress input such as "1.0" intact.
          value={typeof value === "number" ? value : ""}
          onChange={(event) => {
            const next = event.target.valueAsNumber;
            onChange(Number.isFinite(next) ? next : undefined);
          }}
        />
      );
    case "date":
      return (
        <Input
          id={id}
          type="date"
          value={typeof value === "number" ? toDateInputValue(value) : ""}
          onChange={(event) => onChange(fromDateInputValue(event.target.value))}
        />
      );
    case "boolean":
    case "select": {
      const options =
        spec.kind === "boolean"
          ? { yes: booleanLabels.yes, no: booleanLabels.no }
          : spec.options;
      const selected =
        spec.kind === "boolean"
          ? value === true
            ? "yes"
            : value === false
              ? "no"
              : UNSET
          : typeof value === "string"
            ? value
            : UNSET;
      return (
        <Select
          value={selected}
          onValueChange={(next) =>
            onChange(
              next === UNSET
                ? undefined
                : spec.kind === "boolean"
                  ? next === "yes"
                  : next,
            )
          }
        >
          <SelectTrigger id={id} className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={UNSET}>{notSpecifiedLabel}</SelectItem>
            {Object.entries(options).map(([optionValue, optionLabel]) => (
              <SelectItem key={optionValue} value={optionValue}>
                {optionLabel}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      );
    }
  }
}

interface TypeDetailsEditorProps {
  collectionType: CollectionModuleId;
  fields: TypeDetailFieldValues;
  onChange: (fields: TypeDetailFieldValues) => void;
}

/** Inputs for every intake field of one collection type. */
export function TypeDetailsEditor({
  collectionType,
  fields,
  onChange,
}: TypeDetailsEditorProps) {
  const { fieldSpecs, booleanLabels, notSpecifiedLabel } =
    useTypeDetailFieldSpecs();

  return (
    <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
      {Object.entries(fieldSpecs[collectionType]).map(([name, spec]) => {
        const id = `typeDetails-${name}`;
        const setValue = (value: TypeDetailFieldValue | undefined) =>
          onChange({ ...fields, [name]: value });
        const value = fields[name];

        if (spec.kind === "list") {
          return (
            <div key={name} className="space-y-2">
              <RepeatableTextField
                id={id}
                label={spec.label}
                value={Array.isArray(value) ? value : []}
                onChange={setValue}
              />
            </div>
          );
        }

        return (
          <div
            key={name}
            className={
              spec.kind === "textarea"
                ? "space-y-2 md:col-span-2 xl:col-span-3"
                : "space-y-2"
            }
          >
            <Label htmlFor={id}>{spec.label}</Label>
            <TypeDetailFieldInput
              id={id}
              spec={spec}
              value={value}
              onChange={setValue}
              booleanLabels={booleanLabels}
              notSpecifiedLabel={notSpecifiedLabel}
            />
          </div>
        );
      })}
    </div>
  );
}
