"use client";

import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@v1/ui/alert-dialog";
import { Button } from "@v1/ui/button";
import { useState } from "react";
import { useI18n } from "@/locales/client";

// The image editor is a full-screen layer at z-60; confirmations sit above it.
const ABOVE_EDITOR = "z-[70]";

interface ImageDeletionDialogsProps {
  fileName: string;
  /** The accessions approval workflow is on, so deleting asks for approval. */
  requiresApproval: boolean;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Called once staff confirm; the edit form sends it with Update Object. */
  onConfirm: () => void;
}

/**
 * Confirms deleting an image. With approval on, one confirmation marks it for
 * approval; otherwise a second warning says the deletion cannot be undone.
 * Nothing is deleted until the object is updated.
 */
export function ImageDeletionDialogs({
  fileName,
  requiresApproval,
  open,
  onOpenChange,
  onConfirm,
}: ImageDeletionDialogsProps) {
  const t = useI18n();
  const [step, setStep] = useState<"confirm" | "final">("confirm");

  const close = () => {
    onOpenChange(false);
    setStep("confirm");
  };

  const confirm = () => {
    close();
    onConfirm();
  };

  const onDialogOpenChange = (next: boolean) => {
    if (!next) close();
  };

  const sentOnUpdate = (
    <p className="text-sm text-muted-foreground">
      {t("imageDeletion.confirm.sentOnUpdate")}
    </p>
  );

  return (
    <>
      <AlertDialog
        open={open && step === "confirm"}
        onOpenChange={onDialogOpenChange}
      >
        <AlertDialogContent layerClassName={ABOVE_EDITOR}>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {t("imageDeletion.confirm.title")}
            </AlertDialogTitle>
            <AlertDialogDescription className="break-words">
              {fileName}
            </AlertDialogDescription>
            {requiresApproval ? (
              <p className="text-sm text-muted-foreground">
                {t("imageDeletion.confirm.approvalHint")}
              </p>
            ) : null}
            {sentOnUpdate}
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("common.cancel")}</AlertDialogCancel>
            <Button
              type="button"
              variant="destructive"
              onClick={requiresApproval ? confirm : () => setStep("final")}
            >
              {t("common.delete")}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      <AlertDialog
        open={open && step === "final"}
        onOpenChange={onDialogOpenChange}
      >
        <AlertDialogContent layerClassName={ABOVE_EDITOR}>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {t("imageDeletion.finalConfirm.title")}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {t("imageDeletion.finalConfirm.description")}
            </AlertDialogDescription>
            {sentOnUpdate}
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("common.cancel")}</AlertDialogCancel>
            <Button type="button" variant="destructive" onClick={confirm}>
              {t("imageDeletion.deleteImage")}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
