"use client";

import {
  COMPLETENESS_VALUES,
  MEASURED_PARTS,
  type MeasuredPart,
} from "@v1/backend/convex/utils/objectDescription";
import { Input } from "@v1/ui/input";
import { Label } from "@v1/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@v1/ui/select";
import {
  TagsInput,
  TagsInputInput,
  TagsInputItem,
  TagsInputList,
} from "@v1/ui/tags-input";
import { Textarea } from "@v1/ui/textarea";
import {
  FieldError,
  fieldErrorProps,
} from "@/components/record-form/record-form-notices";
import { RightsStatementSelect } from "@/components/rights-statement/rights-statement-select";
import { useOrganizationRightsDefaults } from "@/components/rights-statement/use-organization-rights-defaults";
import { useI18n, useScopedI18n } from "@/locales/client";
import { type CollectionFormTabProps, NO_FIELD_ERRORS } from "./types";

/**
 * The Object's number of objects, subject, completeness, measured part and
 * rights statement, which intake drafts and catalog records both hold.
 */
type DescriptionFieldProps = Pick<
  CollectionFormTabProps,
  "formData" | "updateField" | "fieldErrors"
>;

/** The choice that leaves a select without a value. */
const NOT_STATED = "__none__";

export function NumberOfObjectsField({
  formData,
  updateField,
  fieldErrors = NO_FIELD_ERRORS,
}: DescriptionFieldProps) {
  const t = useScopedI18n("recordForm.objectFields");
  return (
    <div className="space-y-2">
      <Label htmlFor="numberOfObjects">{t("numberOfObjects")}</Label>
      <Input
        id="numberOfObjects"
        inputMode="numeric"
        value={formData.numberOfObjects ?? ""}
        onChange={(event) => updateField("numberOfObjects", event.target.value)}
        {...fieldErrorProps("numberOfObjects", fieldErrors.numberOfObjects)}
      />
      <p className="text-xs text-muted-foreground">
        {t("numberOfObjectsHint")}
      </p>
      <FieldError
        field="numberOfObjects"
        message={fieldErrors.numberOfObjects}
      />
    </div>
  );
}

export function SubjectsField({
  formData,
  updateField,
  fieldErrors = NO_FIELD_ERRORS,
}: DescriptionFieldProps) {
  const t = useScopedI18n("recordForm.objectFields");
  const subjects = formData.subjects ?? [];
  return (
    <div className="space-y-2">
      <Label htmlFor="subjects">{t("subjects")}</Label>
      <TagsInput
        value={subjects}
        onValueChange={(value) =>
          updateField(
            "subjects",
            value.flatMap((term) =>
              String(term).trim() ? [String(term)] : [],
            ),
          )
        }
        addOnPaste
        addOnTab
        blurBehavior="add"
      >
        <TagsInputList>
          {subjects.map((term) => (
            <TagsInputItem key={term} value={term}>
              {term}
            </TagsInputItem>
          ))}
          <TagsInputInput
            id="subjects"
            {...fieldErrorProps("subjects", fieldErrors.subjects)}
          />
        </TagsInputList>
      </TagsInput>
      <p className="text-xs text-muted-foreground">{t("subjectsHint")}</p>
      <FieldError field="subjects" message={fieldErrors.subjects} />
    </div>
  );
}

/**
 * Which part a set of measurements was taken from. The main set's part may
 * be left unstated; a further set's part is chosen from its placeholder.
 */
export function MeasuredPartSelect({
  id,
  value,
  onValueChange,
  optional,
  invalidProps,
}: {
  id: string;
  value: MeasuredPart | undefined;
  onValueChange: (part: MeasuredPart | undefined) => void;
  optional: boolean;
  /** Links the trigger to an error message. */
  invalidProps?: ReturnType<typeof fieldErrorProps>;
}) {
  const tRoot = useI18n();
  return (
    <Select
      // An empty value shows the placeholder and keeps the select controlled.
      value={value ?? (optional ? NOT_STATED : "")}
      onValueChange={(next) =>
        onValueChange(MEASURED_PARTS.find((part) => part === next))
      }
    >
      <SelectTrigger id={id} {...invalidProps}>
        <SelectValue
          placeholder={tRoot("recordForm.objectFields.choosePart")}
        />
      </SelectTrigger>
      <SelectContent>
        {optional ? (
          <SelectItem value={NOT_STATED}>
            {tRoot("recordForm.objectFields.notStated")}
          </SelectItem>
        ) : null}
        {MEASURED_PARTS.map((part) => (
          <SelectItem key={part} value={part}>
            {tRoot(`objectDescription.parts.${part}`)}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

export function CompletenessFields({
  formData,
  updateField,
  fieldErrors = NO_FIELD_ERRORS,
}: DescriptionFieldProps) {
  const tRoot = useI18n();
  const t = useScopedI18n("recordForm.objectFields");
  return (
    <>
      <div className="space-y-2">
        <Label htmlFor="completeness">{t("completeness")}</Label>
        <Select
          value={formData.completeness ?? NOT_STATED}
          onValueChange={(next) =>
            updateField(
              "completeness",
              COMPLETENESS_VALUES.find((value) => value === next),
            )
          }
        >
          <SelectTrigger id="completeness">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={NOT_STATED}>{t("notStated")}</SelectItem>
            {COMPLETENESS_VALUES.map((value) => (
              <SelectItem key={value} value={value}>
                {tRoot(`objectDescription.completeness.${value}`)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-2 md:col-span-2 xl:col-span-2">
        <Label htmlFor="completenessNote">{t("completenessNote")}</Label>
        <Textarea
          autoResize
          id="completenessNote"
          rows={2}
          value={formData.completenessNote ?? ""}
          onChange={(event) =>
            updateField("completenessNote", event.target.value)
          }
          {...fieldErrorProps("completenessNote", fieldErrors.completenessNote)}
        />
        <FieldError
          field="completenessNote"
          message={fieldErrors.completenessNote}
        />
      </div>
    </>
  );
}

export function RightsStatementField({
  formData,
  updateField,
  currentOrganizationId,
}: Pick<
  CollectionFormTabProps,
  "formData" | "updateField" | "currentOrganizationId"
>) {
  const t = useScopedI18n("recordForm.objectFields");
  const defaults = useOrganizationRightsDefaults(currentOrganizationId);
  return (
    <div className="space-y-2">
      <Label htmlFor="rightsStatement">{t("rightsStatement")}</Label>
      <RightsStatementSelect
        id="rightsStatement"
        value={formData.rightsStatement}
        onValueChange={(value) => updateField("rightsStatement", value)}
        organizationDefault={
          defaults && (defaults.objectRightsStatement ?? null)
        }
      />
      <p className="text-xs text-muted-foreground">
        {t("rightsStatementHint")}
      </p>
    </div>
  );
}
