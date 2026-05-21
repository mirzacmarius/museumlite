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
import { AddChildLocationForm } from "./add-child-location-form";
import type { AddChildLocationDialogProps } from "./types";
import { useAddChildLocationForm } from "./use-add-child-location-form";

export function AddChildLocationDialog({
  parentLocationId,
  parentLocationName,
  parentLocationType,
  parentLocationAddress,
  organizationId,
  open,
  onOpenChange,
  onSuccess,
}: AddChildLocationDialogProps) {
  const t = useScopedI18n("locations.form");
  const tCommon = useScopedI18n("common");
  const form = useAddChildLocationForm({
    parentLocationId,
    parentLocationType,
    parentLocationAddress,
    organizationId,
    open,
    onOpenChange,
    onSuccess,
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] w-[min(96vw,960px)] overflow-y-auto sm:max-w-[960px]">
        <form onSubmit={form.handleSubmit}>
          <DialogHeader>
            <DialogTitle>
              {parentLocationId ? t("addChildLocation") : t("addRootLocation")}
            </DialogTitle>
            <DialogDescription>
              {parentLocationId ? (
                <>
                  {t("createUnder")}{" "}
                  <span className="font-medium">{parentLocationName}</span>
                </>
              ) : (
                t("createRootLevel")
              )}
            </DialogDescription>
          </DialogHeader>

          <AddChildLocationForm form={form} />

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
              {form.isSubmitting ? t("creating") : t("createLocation")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
