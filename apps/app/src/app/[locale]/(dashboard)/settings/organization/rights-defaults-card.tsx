"use client";

import { api } from "@v1/backend/convex/_generated/api";
import type { Id } from "@v1/backend/convex/_generated/dataModel";
import type { RightsStatementUri } from "@v1/backend/convex/utils/rightsStatements";
import { Button } from "@v1/ui/button";
import { Label } from "@v1/ui/label";
import { useMutation } from "convex/react";
import { Copyright, Save } from "lucide-react";
import { useReducer } from "react";
import { RightsStatementSelect } from "@/components/rights-statement/rights-statement-select";
import type { OrganizationRightsDefaults } from "@/components/rights-statement/use-organization-rights-defaults";
import { useScopedI18n } from "@/locales/client";

type RightsDefaultField = keyof OrganizationRightsDefaults;

const RIGHTS_DEFAULT_FIELDS = [
  { field: "objectRightsStatement", label: "objects" },
  { field: "mediaRightsStatement", label: "images" },
] as const satisfies ReadonlyArray<{
  field: RightsDefaultField;
  label: string;
}>;

/** Choices not saved yet; null removes that default. */
type RightsDefaultEdits = Partial<
  Record<RightsDefaultField, RightsStatementUri | null>
>;

interface RightsDefaultsState {
  edits: RightsDefaultEdits;
  isSaving: boolean;
  saveFailed: boolean;
}

type RightsDefaultsAction =
  | {
      type: "edit";
      field: RightsDefaultField;
      value: RightsStatementUri | null;
    }
  | { type: "saveStarted" }
  | { type: "saved"; sent: RightsDefaultEdits }
  | { type: "saveFailed" };

function rightsDefaultsReducer(
  state: RightsDefaultsState,
  action: RightsDefaultsAction,
): RightsDefaultsState {
  switch (action.type) {
    case "edit":
      return {
        ...state,
        edits: { ...state.edits, [action.field]: action.value },
      };
    case "saveStarted":
      return { ...state, isSaving: true, saveFailed: false };
    // A save clears the choices it sent; a choice made while it ran stays.
    case "saved":
      return {
        ...state,
        edits: state.edits === action.sent ? {} : state.edits,
        isSaving: false,
      };
    case "saveFailed":
      return { ...state, isSaving: false, saveFailed: true };
  }
}

/**
 * The statements Objects and images show when they record none of their
 * own. The stored defaults show through any field left alone, and a save
 * sends only the defaults that were changed.
 */
export function RightsDefaultsCard({
  organizationId,
  rightsDefaults,
}: {
  organizationId: Id<"organizations">;
  rightsDefaults: OrganizationRightsDefaults | undefined;
}) {
  const t = useScopedI18n("settings.organization.rightsDefaults");
  const updateRightsDefaults = useMutation(
    api.organizations.updateRightsDefaults,
  );
  const [{ edits, isSaving, saveFailed }, dispatch] = useReducer(
    rightsDefaultsReducer,
    { edits: {}, isSaving: false, saveFailed: false },
  );

  const handleSave = async () => {
    dispatch({ type: "saveStarted" });
    try {
      await updateRightsDefaults({ organizationId, rightsDefaults: edits });
      dispatch({ type: "saved", sent: edits });
    } catch {
      dispatch({ type: "saveFailed" });
    }
  };

  return (
    <div className="rounded-lg border border-border bg-card p-6">
      <div className="mb-2 flex items-center gap-2">
        <Copyright className="size-5" />
        <h2 className="text-lg font-medium">{t("title")}</h2>
      </div>
      <p className="mb-4 text-sm text-muted-foreground">{t("description")}</p>
      <div className="grid gap-4 sm:grid-cols-2">
        {RIGHTS_DEFAULT_FIELDS.map(({ field, label }) => {
          const id = `rights-default-${field}`;
          const edit = edits[field];
          return (
            <div key={field} className="space-y-2">
              <Label htmlFor={id}>{t(label)}</Label>
              <RightsStatementSelect
                id={id}
                value={
                  edit === undefined
                    ? rightsDefaults?.[field]
                    : (edit ?? undefined)
                }
                onValueChange={(value) =>
                  dispatch({ type: "edit", field, value: value ?? null })
                }
                organizationDefault={null}
                emptyLabel={t("noDefault")}
              />
            </div>
          );
        })}
      </div>
      {saveFailed ? (
        <p role="alert" className="mt-4 text-sm text-destructive">
          {t("saveError")}
        </p>
      ) : null}
      <div className="mt-4 flex justify-end">
        <Button
          type="button"
          onClick={handleSave}
          disabled={isSaving || Object.keys(edits).length === 0}
        >
          <Save className="mr-2 size-4" />
          {t("save")}
        </Button>
      </div>
    </div>
  );
}
