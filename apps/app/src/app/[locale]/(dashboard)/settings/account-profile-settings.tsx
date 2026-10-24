"use client";

import { useForm } from "@tanstack/react-form";
import { api } from "@v1/backend/convex/_generated/api";
import type { Id } from "@v1/backend/convex/_generated/dataModel";
import { isUploadRateLimited } from "@v1/backend/convex/utils/uploadErrors";
import * as validators from "@v1/backend/convex/utils/validators";
import { Button } from "@v1/ui/button";
import { Input } from "@v1/ui/input";
import { UploadInput } from "@v1/ui/upload-input";
import { useDoubleCheck } from "@v1/ui/utils";
import type { UploadFileResponse } from "@xixixao/uploadstuff/react";
import { useAction, useMutation, useQuery } from "convex/react";
import { Upload } from "lucide-react";
import Image from "next/image";
import { type ReactNode, useState } from "react";
import { useSignOut } from "@/hooks/use-sign-out";
import { useScopedI18n } from "@/locales/client";

export function AccountProfileSettings({ children }: { children?: ReactNode }) {
  const t = useScopedI18n("settings");
  const user = useQuery(api.users.getUser);
  const signOut = useSignOut();
  const updateUserImage = useMutation(api.users.updateUserImage);
  const updateUsername = useMutation(api.users.updateUsername);
  const updateName = useMutation(api.users.updateName);
  const removeUserImage = useMutation(api.users.removeUserImage);
  const generateUploadUrl = useMutation(api.users.generateUploadUrl);
  const deleteCurrentUserAccount = useAction(
    api.users.deleteCurrentUserAccount,
  );
  const { doubleCheck, getButtonProps } = useDoubleCheck();
  const [nameSaveState, setNameSaveState] = useState<
    "idle" | "saving" | "saved" | "error"
  >("idle");
  const [avatarError, setAvatarError] = useState<
    "uploadFailed" | "uploadRateLimited" | null
  >(null);

  const handleUpdateUserImage = async (uploaded: UploadFileResponse[]) => {
    const response = uploaded[0]?.response;
    if (
      typeof response !== "object" ||
      response === null ||
      !("storageId" in response) ||
      typeof response.storageId !== "string"
    ) {
      throw new Error("Upload returned no file");
    }
    await updateUserImage({
      imageId: response.storageId as Id<"_storage">,
    });
  };

  const handleAvatarUploadError = (error: unknown) => {
    setAvatarError(
      isUploadRateLimited(error) ? "uploadRateLimited" : "uploadFailed",
    );
  };

  const handleDeleteAccount = async () => {
    await deleteCurrentUserAccount();
    signOut();
  };

  const handleGenerateUploadUrl = async (mimeType: string) => {
    setAvatarError(null);
    return await generateUploadUrl({ mimeType });
  };

  const nameForm = useForm({
    defaultValues: {
      name: user?.name || "",
    },
    onSubmit: async ({ value }) => {
      setNameSaveState("saving");
      try {
        await updateName({ name: value.name || "" });
        setNameSaveState("saved");
      } catch {
        setNameSaveState("error");
      }
    },
  });

  const usernameForm = useForm({
    defaultValues: {
      username: user?.username || "",
    },
    onSubmit: async ({ value }) => {
      await updateUsername({ username: value.username || "" });
    },
  });

  if (user === undefined) {
    return (
      <div className="flex flex-col gap-4 sm:gap-6" aria-busy="true">
        {[0, 1, 2, 3].map((item) => (
          <div
            key={item}
            className="h-40 animate-pulse rounded-lg border border-border bg-card"
          />
        ))}
      </div>
    );
  }
  if (user === null) {
    return null;
  }

  const avatarUrl = user.avatarUrl ?? user.image;
  const avatarAlt = user.name ?? user.username ?? user.email ?? "User avatar";
  const hasCustomAvatar = Boolean(user.imageId);

  return (
    <div className="flex size-full flex-col gap-4 sm:gap-6">
      {/* Avatar */}
      <div className="flex w-full flex-col items-start rounded-lg border border-border bg-card">
        <div className="flex w-full flex-col-reverse sm:flex-row items-start sm:justify-between gap-4 rounded-lg p-4 sm:p-6">
          <div className="flex flex-col gap-2">
            <h2 className="text-lg sm:text-xl font-medium text-foreground">
              {t("avatar.title")}
            </h2>
            <p className="text-sm font-normal text-muted-foreground">
              {t("avatar.description")}
            </p>
          </div>
          <label
            htmlFor="avatar_field"
            className="group relative flex cursor-pointer overflow-hidden rounded-full transition active:scale-95"
          >
            {avatarUrl ? (
              <Image
                src={avatarUrl}
                className="size-20 rounded-full object-cover"
                alt={avatarAlt}
                width={80}
                height={80}
                unoptimized
              />
            ) : (
              <div className="size-20 rounded-full bg-gradient-to-br from-lime-400 from-10% via-cyan-300 to-blue-500" />
            )}
            <div className="absolute z-10 hidden size-full items-center justify-center bg-primary/40 group-hover:flex">
              <Upload className="size-6 text-secondary" />
            </div>
          </label>
          <UploadInput
            id="avatar_field"
            type="file"
            accept="image/*"
            className="peer sr-only"
            required
            tabIndex={user ? -1 : 0}
            generateUploadUrl={handleGenerateUploadUrl}
            onUploadComplete={handleUpdateUserImage}
            onUploadError={handleAvatarUploadError}
          />
        </div>
        <div className="flex min-h-14 w-full flex-col sm:flex-row items-start sm:items-center justify-between gap-2 sm:gap-0 rounded-lg rounded-t-none border-t border-border bg-secondary px-4 sm:px-6 py-3 sm:py-0 dark:bg-card">
          {avatarError ? (
            <p role="alert" className="text-sm font-normal text-destructive">
              {avatarError === "uploadRateLimited"
                ? t("avatar.uploadRateLimited")
                : t("avatar.uploadFailed")}
            </p>
          ) : (
            <p className="text-sm font-normal text-muted-foreground">
              {t("avatar.uploadHint")}
            </p>
          )}
          {hasCustomAvatar && (
            <Button
              type="button"
              size="sm"
              variant="secondary"
              onClick={() => {
                removeUserImage({});
              }}
            >
              {t("avatar.resetButton")}
            </Button>
          )}
        </div>
      </div>

      {/* Name */}
      <form
        className="flex w-full flex-col items-start rounded-lg border border-border bg-card"
        action={() => {
          void nameForm.handleSubmit();
        }}
      >
        <div className="flex w-full flex-col gap-4 rounded-lg p-4 sm:p-6">
          <div className="flex flex-col gap-2">
            <h2 className="text-lg sm:text-xl font-medium text-foreground">
              {t("name.title")}
            </h2>
            <p className="text-sm font-normal text-muted-foreground">
              {t("name.description")}
            </p>
          </div>
          <nameForm.Field name="name">
            {(field) => (
              <Input
                placeholder={t("name.placeholder")}
                aria-label={t("name.title")}
                autoComplete="name"
                required
                maxLength={64}
                value={field.state.value}
                onBlur={field.handleBlur}
                onChange={(e) => field.handleChange(e.target.value)}
                className="w-full sm:w-80 bg-transparent"
              />
            )}
          </nameForm.Field>
        </div>
        <div className="flex min-h-14 w-full flex-col sm:flex-row items-start sm:items-center justify-between gap-2 sm:gap-0 rounded-lg rounded-t-none border-t border-border bg-secondary px-4 sm:px-6 py-3 sm:py-0 dark:bg-card">
          <p className="text-sm font-normal text-muted-foreground">
            {t("name.hint")}
          </p>
          <p aria-live="polite" className="text-sm text-muted-foreground">
            {nameSaveState === "saved" ? t("name.saved") : ""}
            {nameSaveState === "error" ? t("name.error") : ""}
          </p>
          <Button type="submit" size="sm" disabled={nameSaveState === "saving"}>
            {nameSaveState === "saving" ? t("name.saving") : t("name.save")}
          </Button>
        </div>
      </form>

      {/* Username */}
      <form
        className="flex w-full flex-col items-start rounded-lg border border-border bg-card"
        action={() => {
          void usernameForm.handleSubmit();
        }}
      >
        <div className="flex w-full flex-col gap-4 rounded-lg p-4 sm:p-6">
          <div className="flex flex-col gap-2">
            <h2 className="text-lg sm:text-xl font-medium text-foreground">
              {t("username.title")}
            </h2>
            <p className="text-sm font-normal text-muted-foreground">
              {t("username.description")}
            </p>
          </div>
          <usernameForm.Field
            name="username"
            validators={{
              onSubmit: validators.username,
            }}
          >
            {(field) => (
              <Input
                placeholder={t("username.placeholder")}
                autoComplete="off"
                required
                value={field.state.value}
                onBlur={field.handleBlur}
                onChange={(e) => field.handleChange(e.target.value)}
                className={`w-full sm:w-80 bg-transparent ${
                  field.state.meta?.errors.length > 0 &&
                  "border-destructive focus-visible:ring-destructive"
                }`}
              />
            )}
          </usernameForm.Field>
          {(usernameForm.state.fieldMeta.username?.errors?.length ?? 0) > 0 && (
            <p className="text-sm text-destructive dark:text-destructive-foreground">
              {usernameForm.state.fieldMeta.username?.errors.join(" ")}
            </p>
          )}
        </div>
        <div className="flex min-h-14 w-full flex-col sm:flex-row items-start sm:items-center justify-between gap-2 sm:gap-0 rounded-lg rounded-t-none border-t border-border bg-secondary px-4 sm:px-6 py-3 sm:py-0 dark:bg-card">
          <p className="text-sm font-normal text-muted-foreground">
            {t("username.hint")}
          </p>
          <Button type="submit" size="sm">
            {t("username.save")}
          </Button>
        </div>
      </form>

      {children}

      {/* Delete Account */}
      <div className="flex w-full flex-col items-start rounded-lg border border-destructive bg-card">
        <div className="flex flex-col gap-2 p-4 sm:p-6">
          <h2 className="text-lg sm:text-xl font-medium text-foreground">
            {t("deleteAccount.title")}
          </h2>
          <p className="text-sm font-normal text-muted-foreground">
            {t("deleteAccount.description")}
          </p>
        </div>
        <div className="flex min-h-14 w-full flex-col sm:flex-row items-start sm:items-center justify-between gap-2 sm:gap-0 rounded-lg rounded-t-none border-t border-border bg-red-500/10 px-4 sm:px-6 py-3 sm:py-0 dark:bg-red-500/10">
          <p className="text-sm font-normal text-muted-foreground">
            {t("deleteAccount.warning")}
          </p>
          <Button
            size="sm"
            variant="destructive"
            className="flex-shrink-0"
            {...getButtonProps({
              onClick: doubleCheck ? handleDeleteAccount : undefined,
            })}
          >
            {doubleCheck
              ? t("deleteAccount.confirmButton")
              : t("deleteAccount.deleteButton")}
          </Button>
        </div>
      </div>
    </div>
  );
}
