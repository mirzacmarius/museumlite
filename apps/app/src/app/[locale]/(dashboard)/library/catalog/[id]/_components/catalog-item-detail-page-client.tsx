"use client";

import { api } from "@v1/backend/convex/_generated/api";
import type { Id } from "@v1/backend/convex/_generated/dataModel";
import { Button } from "@v1/ui/button";
import { useMutation, useQuery } from "convex/react";
import { Loader2 } from "lucide-react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useReducer } from "react";
import { useOrganization } from "@/components/organization-provider";
import { useFeatureAccess } from "@/hooks/use-feature-access";
import { useScopedI18n } from "@/locales/client";
import { CatalogItemAddCopyDialog } from "./catalog-item-add-copy-dialog";
import { CatalogItemDetailBody } from "./catalog-item-detail-body";
import { CatalogItemDetailHeader } from "./catalog-item-detail-header";
import type { Condition } from "./catalog-item-detail-types";
import type { CatalogItemDetailItem } from "./catalog-item-detail-view-props";

interface CatalogItemDetailPageState {
  isAddCopyOpen: boolean;
  newCopyBarcode: string;
  newCopyCondition: Condition;
  newCopyShelfLocation: string;
  isAddingCopy: boolean;
}

type CatalogItemDetailPageAction =
  | { type: "setAddCopyOpen"; value: boolean }
  | { type: "setNewCopyBarcode"; value: string }
  | { type: "setNewCopyCondition"; value: Condition }
  | { type: "setNewCopyShelfLocation"; value: string }
  | { type: "setAddingCopy"; value: boolean }
  | { type: "closeAddCopyDialog" };

const initialCatalogItemDetailPageState: CatalogItemDetailPageState = {
  isAddCopyOpen: false,
  newCopyBarcode: "",
  newCopyCondition: "good",
  newCopyShelfLocation: "",
  isAddingCopy: false,
};

function catalogItemDetailPageReducer(
  state: CatalogItemDetailPageState,
  action: CatalogItemDetailPageAction,
): CatalogItemDetailPageState {
  switch (action.type) {
    case "setAddCopyOpen":
      return { ...state, isAddCopyOpen: action.value };
    case "setNewCopyBarcode":
      return { ...state, newCopyBarcode: action.value };
    case "setNewCopyCondition":
      return { ...state, newCopyCondition: action.value };
    case "setNewCopyShelfLocation":
      return { ...state, newCopyShelfLocation: action.value };
    case "setAddingCopy":
      return { ...state, isAddingCopy: action.value };
    case "closeAddCopyDialog":
      return {
        ...state,
        isAddCopyOpen: false,
        newCopyBarcode: "",
        newCopyCondition: "good",
        newCopyShelfLocation: "",
      };
  }
}

export function CatalogItemDetailPageClient() {
  const params = useParams();
  const { push } = useRouter();
  const itemId = params.id as Id<"libraryItems">;
  const { currentOrganizationId } = useOrganization();
  const { hasModule } = useFeatureAccess();
  const tDetail = useScopedI18n("library.catalog.detail");
  const tLib = useScopedI18n("library");

  const isLibraryEnabled = hasModule("library");

  const [state, dispatch] = useReducer(
    catalogItemDetailPageReducer,
    initialCatalogItemDetailPageState,
  );

  const item = useQuery(
    api.library.items.get,
    isLibraryEnabled ? { itemId } : "skip",
  );
  const copies = useQuery(
    api.library.copies.listByItem,
    isLibraryEnabled ? { itemId } : "skip",
  );

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
    if (!state.newCopyBarcode.trim()) return;

    dispatch({ type: "setAddingCopy", value: true });
    try {
      await createCopy({
        itemId,
        barcode: state.newCopyBarcode.trim(),
        condition: state.newCopyCondition,
        shelfLocation: state.newCopyShelfLocation || undefined,
      });
      dispatch({ type: "closeAddCopyDialog" });
    } catch (error) {
      console.error("Failed to add copy:", error);
    } finally {
      dispatch({ type: "setAddingCopy", value: false });
    }
  };

  const handleDeleteCopy = async (copyId: Id<"itemCopies">) => {
    await deleteCopy({ copyId });
  };

  if (isLibraryEnabled === false) {
    return (
      <div className="flex size-full items-center justify-center">
        <div className="text-center">
          <p className="text-muted-foreground">{tLib("notEnabled")}</p>
          <Button asChild className="mt-4">
            <Link href="/settings/integrations">
              {tLib("enableIntegration")}
            </Link>
          </Button>
        </div>
      </div>
    );
  }

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
          setIsAddCopyOpen={(value) =>
            dispatch({ type: "setAddCopyOpen", value })
          }
        />
        <CatalogItemAddCopyDialog
          isAddCopyOpen={state.isAddCopyOpen}
          setIsAddCopyOpen={(value) =>
            dispatch({ type: "setAddCopyOpen", value })
          }
          newCopyBarcode={state.newCopyBarcode}
          setNewCopyBarcode={(value) =>
            dispatch({ type: "setNewCopyBarcode", value })
          }
          newCopyCondition={state.newCopyCondition}
          setNewCopyCondition={(value) =>
            dispatch({ type: "setNewCopyCondition", value })
          }
          newCopyShelfLocation={state.newCopyShelfLocation}
          setNewCopyShelfLocation={(value) =>
            dispatch({ type: "setNewCopyShelfLocation", value })
          }
          isAddingCopy={state.isAddingCopy}
          handleAddCopy={handleAddCopy}
          generateBarcode={generateBarcode}
          getConditionLabel={getConditionLabel}
        />
      </div>
    </div>
  );
}
