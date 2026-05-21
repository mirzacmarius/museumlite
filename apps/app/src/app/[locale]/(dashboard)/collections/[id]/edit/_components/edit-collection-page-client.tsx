"use client";

import { useOrganization } from "@/components/organization-provider";
import { UnsavedChangesDialog } from "@/components/unsaved-changes-dialog";
import { useAutoSave } from "@/hooks/use-auto-save";
import { useBeforeUnload } from "@/hooks/use-before-unload";
import { useScopedI18n } from "@/locales/client";
import { api } from "@v1/backend/convex/_generated/api";
import type { Id } from "@v1/backend/convex/_generated/dataModel";
import { Button } from "@v1/ui/button";
import { useMutation, useQuery } from "convex/react";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import {
  type Dispatch,
  type SetStateAction,
  useCallback,
  useEffect,
  useReducer,
} from "react";
import { EditCollectionDeleteZone } from "./edit-collection-delete-zone";
import {
  type EditCollectionFormData,
  EditCollectionFormFields,
} from "./edit-collection-form-fields";

interface EditCollectionPageState {
  isDeleting: boolean;
  error: string | null;
  showUnsavedDialog: boolean;
  pendingNavigation: string | null;
  formData: EditCollectionFormData;
  isInitialized: boolean;
}

type EditCollectionPageAction =
  | { type: "setDeleting"; value: boolean }
  | { type: "setError"; value: string | null }
  | { type: "setShowUnsavedDialog"; value: boolean }
  | { type: "setPendingNavigation"; value: string | null }
  | { type: "setFormData"; value: EditCollectionFormData }
  | { type: "initializeFormData"; value: EditCollectionFormData }
  | { type: "closeUnsavedDialog" };

const initialEditCollectionPageState: EditCollectionPageState = {
  isDeleting: false,
  error: null,
  showUnsavedDialog: false,
  pendingNavigation: null,
  formData: {
    name: "",
    description: "",
    curatorId: "",
    managedByRoleId: "",
  },
  isInitialized: false,
};

function editCollectionPageReducer(
  state: EditCollectionPageState,
  action: EditCollectionPageAction,
): EditCollectionPageState {
  switch (action.type) {
    case "setDeleting":
      return { ...state, isDeleting: action.value };
    case "setError":
      return { ...state, error: action.value };
    case "setShowUnsavedDialog":
      return { ...state, showUnsavedDialog: action.value };
    case "setPendingNavigation":
      return { ...state, pendingNavigation: action.value };
    case "setFormData":
      return { ...state, formData: action.value };
    case "initializeFormData":
      return { ...state, formData: action.value, isInitialized: true };
    case "closeUnsavedDialog":
      return {
        ...state,
        showUnsavedDialog: false,
        pendingNavigation: null,
      };
  }
}

export function EditCollectionPageClient() {
  const t = useScopedI18n("collections");
  const common = useScopedI18n("common");
  const params = useParams();
  const { push } = useRouter();
  const groupId = params.id as Id<"collectionGroups">;
  const { currentOrganizationId } = useOrganization();
  const updateGroup = useMutation(api.collectionGroups.update);
  const deleteGroup = useMutation(api.collectionGroups.deleteGroup);

  const group = useQuery(api.collectionGroups.get, { groupId });

  const members = useQuery(
    api.organizations.listOrganizationUsers,
    currentOrganizationId ? { organizationId: currentOrganizationId } : "skip",
  );

  const roles = useQuery(
    api.roles.listRoles,
    currentOrganizationId ? { organizationId: currentOrganizationId } : "skip",
  );

  const [state, dispatch] = useReducer(
    editCollectionPageReducer,
    initialEditCollectionPageState,
  );

  const setFormData: Dispatch<SetStateAction<EditCollectionFormData>> =
    useCallback(
      (value) => {
        dispatch({
          type: "setFormData",
          value:
            typeof value === "function" ? value(state.formData) : value,
        });
      },
      [state.formData],
    );

  useEffect(() => {
    if (group && !state.isInitialized) {
      dispatch({
        type: "initializeFormData",
        value: {
          name: group.name || "",
          description: group.description || "",
          curatorId: group.curatorId || "",
          managedByRoleId: group.managedByRoleId || "",
        },
      });
    }
  }, [group, state.isInitialized]);

  const handleAutoSave = useCallback(
    async (data: EditCollectionFormData) => {
      if (!data.name.trim()) return;

      await updateGroup({
        groupId,
        name: data.name,
        description: data.description || undefined,
        curatorId: data.curatorId ? (data.curatorId as Id<"users">) : null,
        managedByRoleId: data.managedByRoleId
          ? (data.managedByRoleId as Id<"roles">)
          : null,
      });
    },
    [groupId, updateGroup],
  );

  const { status, lastSaved, isDirty, save } = useAutoSave({
    data: state.formData,
    onSave: handleAutoSave,
    enabled: state.isInitialized && !!state.formData.name.trim(),
    debounceMs: 2000,
    onError: (err) => dispatch({ type: "setError", value: err.message }),
  });

  useBeforeUnload(isDirty);

  const handleNavigate = useCallback(
    (href: string) => {
      if (isDirty) {
        dispatch({ type: "setPendingNavigation", value: href });
        dispatch({ type: "setShowUnsavedDialog", value: true });
      } else {
        push(href);
      }
    },
    [isDirty, push],
  );

  const handleDiscardAndNavigate = useCallback(() => {
    if (state.pendingNavigation) {
      push(state.pendingNavigation);
    }
    dispatch({ type: "closeUnsavedDialog" });
  }, [state.pendingNavigation, push]);

  const handleSaveAndNavigate = useCallback(async () => {
    await save();
    if (state.pendingNavigation) {
      push(state.pendingNavigation);
    }
    dispatch({ type: "closeUnsavedDialog" });
    return true;
  }, [state.pendingNavigation, push, save]);

  if (!currentOrganizationId) {
    return (
      <div className="flex size-full items-center justify-center">
        <p className="text-muted-foreground">{t("selectOrganizationEdit")}</p>
      </div>
    );
  }

  if (group === undefined) {
    return (
      <div className="flex size-full items-center justify-center">
        <p className="text-muted-foreground">{common("loading")}</p>
      </div>
    );
  }

  if (group === null) {
    return (
      <div className="flex size-full items-center justify-center">
        <p className="text-muted-foreground">{t("notFound")}</p>
      </div>
    );
  }

  const handleDelete = async () => {
    dispatch({ type: "setDeleting", value: true });
    try {
      await deleteGroup({ groupId });
      push("/collections");
    } catch (err) {
      console.error("Failed to delete collection:", err);
      dispatch({ type: "setDeleting", value: false });
    }
  };

  return (
    <div className="flex size-full bg-background px-6">
      <div className="z-10 mx-auto flex size-full max-w-screen-xl gap-12">
        <div className="flex w-full flex-col rounded-lg border border-border bg-card">
          <div className="flex w-full items-center justify-between rounded-lg border-b border-border p-6">
            <Button variant="ghost" size="sm" asChild>
              <Link href={`/collections/${groupId}`}>
                <ArrowLeft className="mr-2 size-4" />
                {t("backToCollection")}
              </Link>
            </Button>
          </div>

          <div className="p-6">
            {state.error && (
              <div className="mb-6 rounded-lg border border-destructive bg-destructive/10 p-3 text-sm text-destructive">
                {state.error}
              </div>
            )}
            <EditCollectionFormFields
              groupId={groupId}
              formData={state.formData}
              setFormData={setFormData}
              members={members}
              roles={roles}
              status={status}
              lastSaved={lastSaved}
              isDirty={isDirty}
              error={state.error}
              onNavigate={handleNavigate}
              onSave={save}
            />
            <EditCollectionDeleteZone
              groupName={group.name}
              isDeleting={state.isDeleting}
              onDelete={handleDelete}
            />
          </div>

          <UnsavedChangesDialog
            open={state.showUnsavedDialog}
            onOpenChange={(value) =>
              dispatch({ type: "setShowUnsavedDialog", value })
            }
            onDiscard={handleDiscardAndNavigate}
            onSave={handleSaveAndNavigate}
            isSaving={status === "saving"}
          />
        </div>
      </div>
    </div>
  );
}
