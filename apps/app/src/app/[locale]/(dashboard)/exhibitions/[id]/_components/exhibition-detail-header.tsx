"use client";

import { PermissionGate } from "@/components/permission-gate";
import { useScopedI18n } from "@/locales/client";
import { Button } from "@v1/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@v1/ui/dialog";
import { ArrowLeft, Pencil, Trash2 } from "lucide-react";
import Link from "next/link";
import type { ExhibitionDetailViewProps } from "./exhibition-detail-view-props";

export function ExhibitionDetailHeader({
  exhibitionId,
  exhibition,
  isDeleting,
  handleDelete,
}: Pick<
  ExhibitionDetailViewProps,
  "exhibitionId" | "exhibition" | "isDeleting" | "handleDelete"
>) {
  const t = useScopedI18n("exhibitions");

  return (
    <header className="sticky top-0 z-50 flex h-14 items-center justify-between border-b border-border bg-background/80 px-6 backdrop-blur-xl">
      <div className="flex items-center gap-2 text-xs">
        <Button variant="ghost" size="icon" className="size-7" asChild>
          <Link href="/exhibitions">
            <ArrowLeft className="size-4 text-muted-foreground" />
          </Link>
        </Button>
        <span className="text-muted-foreground">{t("title")}</span>
        <span className="text-muted-foreground">/</span>
        <span className="max-w-[200px] truncate font-medium text-foreground">
          {exhibition.title}
        </span>
      </div>

      <div className="flex items-center gap-2">
        <PermissionGate permission="collections.update">
          <Button
            variant="outline"
            size="sm"
            asChild
            className="border-border text-foreground/80 hover:bg-muted hover:text-white"
          >
            <Link href={`/exhibitions/${exhibitionId}/edit`}>
              <Pencil className="mr-2 size-3.5" />
              {t("actions.edit")}
            </Link>
          </Button>
        </PermissionGate>

        <PermissionGate permission="collections.delete">
          <Dialog>
            <DialogTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                className="border-red-900/30 text-red-400 hover:border-red-900/50 hover:bg-red-950/50 hover:text-red-300"
              >
                <Trash2 className="mr-2 size-3.5" />
                {t("actions.delete")}
              </Button>
            </DialogTrigger>
            <DialogContent className="border-border bg-background sm:max-w-[425px]">
              <DialogHeader>
                <DialogTitle className="text-foreground">
                  {t("actions.delete")}
                </DialogTitle>
                <DialogDescription className="text-muted-foreground">
                  {t("actions.deleteConfirm")}
                </DialogDescription>
              </DialogHeader>
              <DialogFooter>
                <Button
                  variant="outline"
                  className="border-border text-foreground/80 hover:bg-muted"
                  disabled={isDeleting}
                >
                  {t("actions.cancel")}
                </Button>
                <Button
                  variant="destructive"
                  onClick={handleDelete}
                  disabled={isDeleting}
                  className="bg-red-900 text-red-100 hover:bg-red-800"
                >
                  {isDeleting ? t("actions.deleting") : t("actions.delete")}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </PermissionGate>
      </div>
    </header>
  );
}
