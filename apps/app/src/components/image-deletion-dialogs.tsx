"use client";

import { api } from "@v1/backend/convex/_generated/api";
import type { Id } from "@v1/backend/convex/_generated/dataModel";
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
import { useMutation } from "convex/react";
import { Loader2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { useImageDeletionErrorMessage } from "@/hooks/use-image-deletion-error-message";
import { useI18n } from "@/locales/client";

// The image editor is a full-screen layer at z-60; confirmations sit above it.
const ABOVE_EDITOR = "z-[70]";

interface ImageDeletionDialogsProps {
  mediaId: Id<"mediaFiles">;
  fileName: string;
  /** The accessions approval workflow is on, so deleting asks for approval. */
  requiresApproval: boolean;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Called once the image is deleted or its deletion is sent for approval. */
  onDone: () => void;
}

/**
 * Confirms deleting an image. With approval on, confirming sends the
 * deletion for approval; otherwise a second warning says it cannot be undone.
 */
export function ImageDeletionDialogs({
  mediaId,
  fileName,
  requiresApproval,
  open,
  onOpenChange,
  onDone,
}: ImageDeletionDialogsProps) {
  const t = useI18n();
  const errorMessage = useImageDeletionErrorMessage();
  const requestDeletion = useMutation(api.mediaDeletions.requestImageDeletion);
  const deleteImage = useMutation(api.mediaDeletions.deleteImage);
  const [step, setStep] = useState<"confirm" | "final">("confirm");
  const [isWorking, setIsWorking] = useState(false);

  const close = () => {
    onOpenChange(false);
    setStep("confirm");
  };

  const run = async (command: () => Promise<unknown>, success: string) => {
    setIsWorking(true);
    try {
      await command();
      toast.success(success);
      close();
      onDone();
    } catch (error) {
      toast.error(errorMessage(error, t("imageDeletion.failed")));
    } finally {
      setIsWorking(false);
    }
  };

  const confirm = () => {
    if (requiresApproval) {
      void run(
        () => requestDeletion({ mediaId }),
        t("imageDeletion.requested"),
      );
      return;
    }
    setStep("final");
  };

  const onDialogOpenChange = (next: boolean) => {
    if (!next && !isWorking) close();
  };

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
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isWorking}>
              {t("common.cancel")}
            </AlertDialogCancel>
            <Button
              type="button"
              variant="destructive"
              disabled={isWorking}
              onClick={confirm}
            >
              {isWorking ? (
                <Loader2 className="size-4 animate-spin" aria-hidden="true" />
              ) : null}
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
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isWorking}>
              {t("common.cancel")}
            </AlertDialogCancel>
            <Button
              type="button"
              variant="destructive"
              disabled={isWorking}
              onClick={() =>
                void run(
                  () => deleteImage({ mediaId }),
                  t("imageDeletion.deleted"),
                )
              }
            >
              {isWorking ? (
                <Loader2 className="size-4 animate-spin" aria-hidden="true" />
              ) : null}
              {t("imageDeletion.deleteImage")}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
