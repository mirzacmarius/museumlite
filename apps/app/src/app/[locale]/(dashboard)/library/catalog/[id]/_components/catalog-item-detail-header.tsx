"use client";

import { useScopedI18n } from "@/locales/client";
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
import { Archive, ArrowLeft, Check, Edit, Trash2 } from "lucide-react";
import Link from "next/link";
import { CatalogItemStatusBadge } from "./catalog-item-detail-ui";
import type { CatalogItemDetailViewProps } from "./catalog-item-detail-view-props";

export function CatalogItemDetailHeader({
  item,
  itemId,
  handlePublish,
  handleArchive,
  handleDelete,
}: Pick<
  CatalogItemDetailViewProps,
  "item" | "itemId" | "handlePublish" | "handleArchive" | "handleDelete"
>) {
  const tDetail = useScopedI18n("library.catalog.detail");
  const tCommon = useScopedI18n("common");
  const tLib = useScopedI18n("library");

  return (
    <div className="flex items-center justify-between rounded-lg border border-border bg-card p-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="sm" asChild>
          <Link href="/library/catalog">
            <ArrowLeft className="mr-2 size-4" />
            {tLib("back")}
          </Link>
        </Button>
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-medium">{item.title}</h1>
            <CatalogItemStatusBadge catalogStatus={item.catalogStatus} />
          </div>
          {item.subtitle ? (
            <p className="text-sm text-muted-foreground">{item.subtitle}</p>
          ) : null}
        </div>
      </div>
      <div className="flex gap-2">
        {item.catalogStatus === "draft" ? (
          <Button variant="outline" onClick={handlePublish}>
            <Check className="mr-2 size-4" />
            {tDetail("publish")}
          </Button>
        ) : null}
        {item.catalogStatus === "published" ? (
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="outline">
                <Archive className="mr-2 size-4" />
                {tDetail("archive")}
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>{tDetail("archiveTitle")}</AlertDialogTitle>
                <AlertDialogDescription>
                  {tDetail("archiveDescription")}
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>{tCommon("cancel")}</AlertDialogCancel>
                <AlertDialogAction onClick={handleArchive}>
                  {tDetail("archive")}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        ) : null}
        <Button variant="outline" asChild>
          <Link href={`/library/catalog/${itemId}/edit`}>
            <Edit className="mr-2 size-4" />
            {tDetail("edit")}
          </Link>
        </Button>
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button variant="destructive">
              <Trash2 className="mr-2 size-4" />
              {tCommon("delete")}
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>{tDetail("deleteTitle")}</AlertDialogTitle>
              <AlertDialogDescription>
                {tDetail("deleteDescription")}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>{tCommon("cancel")}</AlertDialogCancel>
              <AlertDialogAction onClick={handleDelete}>
                {tCommon("delete")}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </div>
  );
}
