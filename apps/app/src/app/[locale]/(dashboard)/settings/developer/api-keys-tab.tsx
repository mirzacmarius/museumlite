"use client";

import { api } from "@v1/backend/convex/_generated/api";
import type { Id } from "@v1/backend/convex/_generated/dataModel";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@v1/ui/alert-dialog";
import { Button } from "@v1/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@v1/ui/dialog";
import { Input } from "@v1/ui/input";
import { Label } from "@v1/ui/label";
import { useMutation, useQuery } from "convex/react";
import { Check, Copy, Loader2, Plus, Trash2 } from "lucide-react";
import { useCallback, useReducer } from "react";
import { PermissionGate } from "@/components/permission-gate";
import { writeTextToClipboard } from "@/lib/clipboard";
import { useScopedI18n } from "@/locales/client";

interface ApiKeysTabState {
  showCreate: boolean;
  newKeyName: string;
  createdKey: string | null;
  isCreating: boolean;
  copied: boolean;
}

type ApiKeysTabAction =
  | { type: "openCreateDialog" }
  | { type: "closeDialog" }
  | { type: "setNewKeyName"; value: string }
  | { type: "setCreatedKey"; value: string }
  | { type: "setCreating"; value: boolean }
  | { type: "setCopied"; value: boolean };

const initialApiKeysTabState: ApiKeysTabState = {
  showCreate: false,
  newKeyName: "",
  createdKey: null,
  isCreating: false,
  copied: false,
};

function apiKeysTabReducer(
  state: ApiKeysTabState,
  action: ApiKeysTabAction,
): ApiKeysTabState {
  switch (action.type) {
    case "openCreateDialog":
      return { ...state, showCreate: true };
    case "closeDialog":
      return {
        ...state,
        showCreate: false,
        createdKey: null,
        newKeyName: "",
      };
    case "setNewKeyName":
      return { ...state, newKeyName: action.value };
    case "setCreatedKey":
      return { ...state, createdKey: action.value };
    case "setCreating":
      return { ...state, isCreating: action.value };
    case "setCopied":
      return { ...state, copied: action.value };
  }
}

import { ClientDateText } from "./developer-shared";

export function ApiKeysTab({
  organizationId,
}: {
  organizationId: Id<"organizations">;
}) {
  const t = useScopedI18n("settings");
  const apiKeys = useQuery(api.apiKeys.list, { organizationId });
  const createKey = useMutation(api.apiKeys.create);
  const revokeKey = useMutation(api.apiKeys.revoke);
  const deleteKey = useMutation(api.apiKeys.deleteKey);

  const [state, dispatch] = useReducer(
    apiKeysTabReducer,
    initialApiKeysTabState,
  );

  const handleCreate = async () => {
    if (!state.newKeyName.trim()) return;
    dispatch({ type: "setCreating", value: true });
    try {
      const result = await createKey({
        organizationId,
        name: state.newKeyName.trim(),
        permissions: ["read", "write"],
      });
      dispatch({ type: "setCreatedKey", value: result.key });
      dispatch({ type: "setNewKeyName", value: "" });
    } catch {
      alert(t("errors.failedToCreateKey"));
    } finally {
      dispatch({ type: "setCreating", value: false });
    }
  };

  const handleCopy = useCallback(async () => {
    if (!state.createdKey) {
      return;
    }

    const didCopy = await writeTextToClipboard(state.createdKey);
    if (!didCopy) {
      return;
    }

    dispatch({ type: "setCopied", value: true });
    setTimeout(() => dispatch({ type: "setCopied", value: false }), 2000);
  }, [state.createdKey]);

  const handleRevoke = async (keyId: Id<"apiKeys">) => {
    try {
      await revokeKey({ organizationId, keyId });
    } catch {
      alert(t("errors.failedToRevokeKey"));
    }
  };

  const handleDelete = async (keyId: Id<"apiKeys">) => {
    try {
      await deleteKey({ organizationId, keyId });
    } catch {
      alert(t("errors.failedToDeleteKey"));
    }
  };

  const closeDialog = () => {
    dispatch({ type: "closeDialog" });
  };

  return (
    <PermissionGate permission="organization.manage_settings">
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-semibold">{t("apiKeys.title")}</h2>
            <p className="text-sm text-muted-foreground">
              {t("apiKeys.description")}
            </p>
          </div>
          <Button onClick={() => dispatch({ type: "openCreateDialog" })}>
            <Plus className="mr-2 size-4" />
            {t("apiKeys.createButton")}
          </Button>
        </div>

        <div className="rounded-lg border border-border">
          {!apiKeys ? (
            <div className="flex items-center justify-center p-8">
              <Loader2 className="size-6 animate-spin text-muted-foreground" />
            </div>
          ) : apiKeys.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground">
              {t("apiKeys.noKeys")}
            </div>
          ) : (
            <div className="divide-y divide-border">
              {apiKeys.map((key) => (
                <div
                  key={key._id}
                  className="flex items-center justify-between p-4"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{key.name}</span>
                      {key.isRevoked && (
                        <span className="rounded bg-destructive/10 px-2 py-0.5 text-xs text-destructive">
                          {t("apiKeys.revoked")}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-4 text-sm text-muted-foreground">
                      <code className="rounded bg-muted px-2 py-0.5">
                        {key.prefix}…
                      </code>
                      <span>
                        {t("apiKeys.created")}{" "}
                        <ClientDateText timestamp={key.createdAt} />
                      </span>
                      {key.lastUsedAt && (
                        <span>
                          {t("apiKeys.lastUsed")}{" "}
                          <ClientDateText timestamp={key.lastUsedAt} />
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {!key.isRevoked && (
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button variant="outline" size="sm">
                            {t("apiKeys.revokeButton")}
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>
                              {t("apiKeys.revokeDialog.title")}
                            </AlertDialogTitle>
                            <AlertDialogDescription>
                              {t("apiKeys.revokeDialog.description")}
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>
                              {t("apiKeys.revokeDialog.cancel")}
                            </AlertDialogCancel>
                            <AlertDialogAction
                              onClick={() => handleRevoke(key._id)}
                              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                            >
                              {t("apiKeys.revokeDialog.confirm")}
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    )}
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button variant="ghost" size="icon">
                          <Trash2 className="size-4 text-muted-foreground" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>
                            {t("apiKeys.deleteDialog.title")}
                          </AlertDialogTitle>
                          <AlertDialogDescription>
                            {t("apiKeys.deleteDialog.description")}
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>
                            {t("apiKeys.deleteDialog.cancel")}
                          </AlertDialogCancel>
                          <AlertDialogAction
                            onClick={() => handleDelete(key._id)}
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                          >
                            {t("apiKeys.deleteDialog.confirm")}
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <Dialog open={state.showCreate} onOpenChange={closeDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>
                {state.createdKey
                  ? t("apiKeys.createDialog.createdTitle")
                  : t("apiKeys.createDialog.title")}
              </DialogTitle>
              <DialogDescription>
                {state.createdKey
                  ? t("apiKeys.createDialog.createdDescription")
                  : t("apiKeys.createDialog.description")}
              </DialogDescription>
            </DialogHeader>

            {state.createdKey ? (
              <div className="space-y-4">
                <div className="rounded-lg border border-border bg-muted p-4">
                  <div className="flex items-center justify-between gap-4">
                    <code className="flex-1 break-all text-sm">
                      {state.createdKey}
                    </code>
                    <Button variant="outline" size="icon" onClick={handleCopy}>
                      {state.copied ? (
                        <Check className="size-4 text-green-500" />
                      ) : (
                        <Copy className="size-4" />
                      )}
                    </Button>
                  </div>
                </div>
                <p className="text-sm text-amber-600">
                  {t("apiKeys.createDialog.warning")}
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="key-name">
                    {t("apiKeys.createDialog.nameLabel")}
                  </Label>
                  <Input
                    id="key-name"
                    placeholder={t("apiKeys.createDialog.namePlaceholder")}
                    value={state.newKeyName}
                    onChange={(e) =>
                      dispatch({ type: "setNewKeyName", value: e.target.value })
                    }
                  />
                </div>
              </div>
            )}

            <DialogFooter>
              {state.createdKey ? (
                <Button onClick={closeDialog}>
                  {t("apiKeys.createDialog.done")}
                </Button>
              ) : (
                <>
                  <Button variant="outline" onClick={closeDialog}>
                    {t("apiKeys.createDialog.cancel")}
                  </Button>
                  <Button
                    onClick={handleCreate}
                    disabled={!state.newKeyName.trim() || state.isCreating}
                  >
                    {state.isCreating ? (
                      <Loader2 className="mr-2 size-4 animate-spin" />
                    ) : null}
                    {t("apiKeys.createDialog.create")}
                  </Button>
                </>
              )}
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </PermissionGate>
  );
}
