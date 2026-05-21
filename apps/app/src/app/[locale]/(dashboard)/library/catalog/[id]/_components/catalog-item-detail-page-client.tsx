"use client";

import { useOrganization } from "@/components/organization-provider";
import { useScopedI18n } from "@/locales/client";
import { api } from "@v1/backend/convex/_generated/api";
import type { Id } from "@v1/backend/convex/_generated/dataModel";
import { Button } from "@v1/ui/button";
import { useMutation, useQuery } from "convex/react";
import { Loader2 } from "lucide-react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useState } from "react";
import { CatalogItemAddCopyDialog } from "./catalog-item-add-copy-dialog";
import { CatalogItemDetailBody } from "./catalog-item-detail-body";
import { CatalogItemDetailHeader } from "./catalog-item-detail-header";
import type { Condition } from "./catalog-item-detail-types";
import type { CatalogItemDetailItem } from "./catalog-item-detail-view-props";

export function CatalogItemDetailPageClient() {
  const params = useParams();
  const { push } = useRouter();
  const itemId = params.id as Id<"libraryItems">;
  const { currentOrganizationId } = useOrganization();
  const tDetail = useScopedI18n("library.catalog.detail");
  const tLib = useScopedI18n("library");

  const [isAddCopyOpen, setIsAddCopyOpen] = useState(false);
  const [newCopyBarcode, setNewCopyBarcode] = useState("");
  const [newCopyCondition, setNewCopyCondition] = useState<Condition>("good");
  const [newCopyShelfLocation, setNewCopyShelfLocation] = useState("");
  const [isAddingCopy, setIsAddingCopy] = useState(false);

  const item = useQuery(api.library.items.get, { itemId });
  const copies = useQuery(api.library.copies.listByItem, { itemId });

  const publishItem = useMutation(api.library.items.publish);
  const archiveItem = useMutation(api.library.items.archive);
  const deleteItem = useMutation(api.library.items.remove);
  const createCopy = useMutation(api.library.copies.create);
  const deleteCopy = useMutation(api.library.copies.remove);
  const generateBarcode = useQuery(
    api.library.copies.generateBarcode,
    currentOrganizationId
      ? { organizationId: currentOrganizationId as Id<"organizations"> }
      : "skip",
  );

  const getConditionLabel = (value: string) => {
    return tLib(`conditionOptions.${value}` as "conditionOptions.good");
  };

  const handlePublish = async () => {
    await publishItem({ itemId });
  };

  const handleArchive = async () => {
    await archiveItem({ itemId });
  };

  const handleDelete = async () => {
    await deleteItem({ itemId });
    push("/library/catalog");
  };

  const handleAddCopy = async () => {
    if (!newCopyBarcode.trim()) return;

    setIsAddingCopy(true);
    try {
      await createCopy({
        itemId,
        barcode: newCopyBarcode.trim(),
        condition: newCopyCondition,
        shelfLocation: newCopyShelfLocation || undefined,
      });
      setIsAddCopyOpen(false);
      setNewCopyBarcode("");
      setNewCopyCondition("good");
      setNewCopyShelfLocation("");
    } catch (error) {
      console.error("Failed to add copy:", error);
    } finally {
      setIsAddingCopy(false);
    }
  };

  const handleDeleteCopy = async (copyId: Id<"itemCopies">) => {
    await deleteCopy({ copyId });
  };

  if (item === undefined) {
    return (
      <div className="flex size-full items-center justify-center">
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (item === null) {
    return (
      <div className="flex size-full items-center justify-center">
        <div className="text-center">
          <p className="text-muted-foreground">{tDetail("itemNotFound")}</p>
          <Button asChild className="mt-4">
            <Link href="/library/catalog">{tDetail("backToCatalog")}</Link>
          </Button>
        </div>
      </div>
    );
  }

  const catalogItem = item as CatalogItemDetailItem;

  return (
    <div className="flex size-full bg-background px-6">
      <div className="z-10 mx-auto flex size-full max-w-screen-xl flex-col gap-6 py-6">
        <CatalogItemDetailHeader
          item={catalogItem}
          itemId={itemId}
          handlePublish={handlePublish}
          handleArchive={handleArchive}
          handleDelete={handleDelete}
        />
        <CatalogItemDetailBody
          item={catalogItem}
          copies={copies}
          getConditionLabel={getConditionLabel}
          handleDeleteCopy={handleDeleteCopy}
          setIsAddCopyOpen={setIsAddCopyOpen}
        />
        <CatalogItemAddCopyDialog
          isAddCopyOpen={isAddCopyOpen}
          setIsAddCopyOpen={setIsAddCopyOpen}
          newCopyBarcode={newCopyBarcode}
          setNewCopyBarcode={setNewCopyBarcode}
          newCopyCondition={newCopyCondition}
          setNewCopyCondition={setNewCopyCondition}
          newCopyShelfLocation={newCopyShelfLocation}
          setNewCopyShelfLocation={setNewCopyShelfLocation}
          isAddingCopy={isAddingCopy}
          handleAddCopy={handleAddCopy}
          generateBarcode={generateBarcode}
          getConditionLabel={getConditionLabel}
        />
      </div>
    </div>
  );
}
