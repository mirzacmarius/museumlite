"use client";

import { useScopedI18n } from "@/locales/client";
import { Button } from "@v1/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@v1/ui/dialog";
import { Loader2 } from "lucide-react";
import { EditLocationForm } from "./edit-location-form";
import type { EditLocationDialogProps } from "./types";
import { useEditLocationForm } from "./use-edit-location-form";

export function EditLocationDialog({
  locationId,
  open,
  onOpenChange,
}: EditLocationDialogProps) {
  const t = useScopedI18n("locations.form");
  const tCommon = useScopedI18n("common");
  const form = useEditLocationForm(locationId, open, onOpenChange);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] w-[min(96vw,960px)] overflow-y-auto sm:max-w-[960px]">
        <DialogHeader>
          <DialogTitle>{t("editLocation")}</DialogTitle>
          <DialogDescription>{t("editDescription")}</DialogDescription>
        </DialogHeader>

        {!form.location ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="size-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <form onSubmit={form.handleSubmit}>
            <EditLocationForm form={form} />

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={form.isSubmitting}
              >
                {tCommon("cancel")}
              </Button>
              <Button type="submit" disabled={form.isSubmitting}>
                {form.isSubmitting && (
                  <Loader2 className="mr-2 size-4 animate-spin" />
                )}
                {t("saveChanges")}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
