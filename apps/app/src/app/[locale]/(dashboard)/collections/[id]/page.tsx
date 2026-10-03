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
import type { FunctionReturnType } from "convex/server";
import {
  Archive,
  ArrowLeft,
  ArrowLeftRight,
  Building2,
  ExternalLink,
  Eye,
  FolderInput,
  Package,
  PlusCircle,
  Search,
  Settings,
  Trash2,
  User,
  X,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { useOrganization } from "@/components/organization-provider";
import { PermissionGate } from "@/components/permission-gate";
import { useDrainedCollectionList } from "@/hooks/use-drained-collection-list";
import { formatNumber } from "@/lib/format-number";
import { useCurrentLocale, useI18n, useScopedI18n } from "@/locales/client";
export default function CollectionGroupDetailPage() {
  const t = useScopedI18n("collections");
  const common = useScopedI18n("common");
  const params = useParams();
  const { replace } = useRouter();
  const rawId = params.id as string;
  const { currentOrganizationId } = useOrganization();
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);

  const resolved = useQuery(api.collections.resolveId, { id: rawId });

  const _collection = useQuery(
    api.collections.get,
    resolved?.type === "collection" ? { collectionId: resolved.id } : "skip",
  );

  const group = useQuery(
    api.collectionGroups.get,
    resolved?.type === "collectionGroup" ? { groupId: resolved.id } : "skip",
  );

  useEffect(() => {
    if (resolved?.type === "collection") {
      replace(`/objects/${resolved.id}`);
    }
  }, [resolved, replace]);

  const _groupId =
    resolved?.type === "collectionGroup"
      ? resolved.id
      : (rawId as Id<"collectionGroups">);

  if (resolved?.type === "collection") {
    return (
      <div className="flex size-full items-center justify-center">
        <p className="text-muted-foreground">{t("redirecting")}</p>
      </div>
    );
  }

  if (!currentOrganizationId) {
    return (
      <div className="flex size-full items-center justify-center">
        <p className="text-muted-foreground">
          {t("selectOrganizationDescription")}
        </p>
      </div>
    );
  }

  if (resolved === undefined || group === undefined) {
    return (
      <div className="flex size-full items-center justify-center">
        <p className="text-muted-foreground">{common("loading")}</p>
      </div>
    );
  }

  if (resolved === null || group === null) {
    return (
      <div className="flex size-full items-center justify-center">
        <p className="text-muted-foreground">{t("notFound")}</p>
      </div>
    );
  }

  return (
    <div className="flex size-full bg-background px-6">
      <div className="z-10 mx-auto flex size-full max-w-screen-xl gap-12">
        <div className="flex w-full flex-col rounded-lg border border-border/60 bg-card">
          <div className="flex w-full items-center justify-between rounded-lg p-6">
            <div className="flex items-center gap-4">
              <Button variant="ghost" size="sm" asChild>
                <Link href="/collections">
                  <ArrowLeft className="mr-2 size-4" />
                  {t("back")}
                </Link>
              </Button>
              <div className="flex flex-col gap-1">
                <h2 className="text-xl font-medium text-primary">
                  {group.name}
                </h2>
                <div className="flex items-center gap-3 text-sm font-normal text-primary/60">
                  <span>
                    {group.itemsCount || 0} {t("items")}
                  </span>
                  {group.curatorName && (
                    <span className="flex items-center gap-1">
                      <User className="size-3" />
                      {group.curatorName}
                    </span>
                  )}
                </div>
              </div>
            </div>
            <div className="flex gap-2">
              <PermissionGate permission="collections.update">
                <Button variant="outline" asChild>
                  <Link href={`/collections/${group._id}/edit`}>
                    <Settings className="mr-2 size-4" />
                    {t("settings")}
                  </Link>
                </Button>
              </PermissionGate>
              <PermissionGate permission="collections.update">
                <Button
                  variant="outline"
                  onClick={() => setIsAddDialogOpen(true)}
                >
                  <FolderInput className="mr-2 size-4" />
                  {t("importExisting")}
                </Button>
              </PermissionGate>
              <PermissionGate permission="collections.create">
                <Button asChild>
                  <Link href={`/objects/new?collectionGroupId=${group._id}`}>
                    <PlusCircle className="mr-2 size-4" />
                    {t("newObject")}
                  </Link>
                </Button>
              </PermissionGate>
            </div>
          </div>
          <div className="flex w-full px-6">
            <div className="w-full border-b border-border/60" />
          </div>

          <CollectionGroupKPIs groupId={group._id} />

          <CollectionObjectsList
            organizationId={currentOrganizationId}
            groupId={group._id}
            isAddDialogOpen={isAddDialogOpen}
            onAddDialogOpenChange={setIsAddDialogOpen}
          />
        </div>
      </div>
    </div>
  );
}

function CollectionGroupKPIs({ groupId }: { groupId: Id<"collectionGroups"> }) {
  const locale = useCurrentLocale();
  const t = useScopedI18n("collections");
  const stats = useQuery(api.collectionGroups.getStats, { groupId });

  if (stats === undefined) {
    return (
      <div className="p-6 border-b border-border/60">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {["total", "active", "on-loan", "value"].map((metric) => (
            <div
              key={metric}
              className="bg-muted/30 border border-border/60 rounded-lg p-3 animate-pulse h-16"
            />
          ))}
        </div>
      </div>
    );
  }

  if (stats === null) {
    return null;
  }

  return (
    <div className="p-6 border-b border-border/60">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-muted/30 border border-border/60 rounded-lg p-3 flex items-center gap-3">
          <div className="p-2 bg-primary/10 rounded-md border border-primary/20">
            <Package className="size-4 text-primary" />
          </div>
          <div>
            <div className="text-[10px] text-muted-foreground uppercase tracking-wider font-medium">
              {t("kpi.totalObjects")}
            </div>
            <div className="text-lg font-semibold text-foreground">
              {formatNumber(stats.total, locale)}
            </div>
          </div>
        </div>

        <div className="bg-muted/30 border border-border/60 rounded-lg p-3 flex items-center gap-3">
          <div className="p-2 bg-emerald-500/10 rounded-md border border-emerald-500/20">
            <Eye className="size-4 text-emerald-400" />
          </div>
          <div>
            <div className="text-[10px] text-muted-foreground uppercase tracking-wider font-medium">
              {t("kpi.active")}
            </div>
            <div className="text-lg font-semibold text-foreground">
              {formatNumber(stats.active, locale)}
            </div>
          </div>
        </div>

        <div className="bg-muted/30 border border-border/60 rounded-lg p-3 flex items-center gap-3">
          <div className="p-2 bg-blue-500/10 rounded-md border border-blue-500/20">
            <ArrowLeftRight className="size-4 text-blue-400" />
          </div>
          <div>
            <div className="text-[10px] text-muted-foreground uppercase tracking-wider font-medium">
              {t("kpi.onLoan")}
            </div>
            <div className="text-lg font-semibold text-foreground">
              {formatNumber(stats.loaned, locale)}
            </div>
          </div>
        </div>

        <div className="bg-muted/30 border border-border/60 rounded-lg p-3 flex items-center gap-3">
          <div className="p-2 bg-amber-500/10 rounded-md border border-amber-500/20">
            <Archive className="size-4 text-amber-400" />
          </div>
          <div>
            <div className="text-[10px] text-muted-foreground uppercase tracking-wider font-medium">
              {t("kpi.deaccessioned")}
            </div>
            <div className="text-lg font-semibold text-foreground">
              {formatNumber(stats.deaccessioned, locale)}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function CollectionObjectsList({
  organizationId,
  groupId,
  isAddDialogOpen,
  onAddDialogOpenChange,
}: {
  organizationId: Id<"organizations">;
  groupId: Id<"collectionGroups">;
  isAddDialogOpen: boolean;
  onAddDialogOpenChange: (open: boolean) => void;
}) {
  const tRoot = useI18n();
  const t = useScopedI18n("collections");
  const common = useScopedI18n("common");
  const [selectedCollectionIds, setSelectedCollectionIds] = useState<string[]>(
    [],
  );
  const [searchQuery, setSearchQuery] = useState("");
  const [error, setError] = useState<string | null>(null);

  // Get items in this collection group (using many-to-many relationship)
  const groupItems = useQuery(api.collectionGroups.listItems, { groupId });
  const groupItemCollectionIds = useMemo(
    () => groupItems?.map((item) => item.collectionId) ?? [],
    [groupItems],
  );
  const groupItemImageUrls = useQuery(
    api.media.getBatchPrimaryImageUrls,
    groupItemCollectionIds.length > 0
      ? { collectionIds: groupItemCollectionIds }
      : "skip",
  );
  const groupItemImageUrlMap = useMemo(() => {
    if (!groupItemImageUrls) {
      return new Map<Id<"collections">, string | null>();
    }

    return new Map(
      groupItemImageUrls.map((item) => [item.collectionId, item.url]),
    );
  }, [groupItemImageUrls]);

  const { items: collections, isComplete: isCollectionListComplete } =
    useDrainedCollectionList(
      organizationId && isAddDialogOpen
        ? {
            organizationId,
            status: "active",
            search: searchQuery || undefined,
          }
        : "skip",
    );

  const addItems = useMutation(api.collectionGroups.addItems);
  const removeItems = useMutation(api.collectionGroups.removeItems);

  // Filter out collections already in this group
  const availableCollections = useMemo(() => {
    if (!groupItems) return [];
    const existingIds = new Set(groupItems.map((item) => item.collectionId));
    return collections.filter((c) => !existingIds.has(c._id));
  }, [collections, groupItems]);

  const handleDialogOpenChange = (open: boolean) => {
    onAddDialogOpenChange(open);
    if (!open) {
      setSearchQuery("");
      setSelectedCollectionIds([]);
      setError(null);
    }
  };

  const handleAddItems = async () => {
    if (selectedCollectionIds.length === 0) {
      setError(t("importDialog.errorSelectOne"));
      return;
    }

    setError(null);
    try {
      await addItems({
        groupId,
        collectionIds: selectedCollectionIds as Id<"collections">[],
      });
      setSelectedCollectionIds([]);
      onAddDialogOpenChange(false);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : t("importDialog.errorAddFailed"),
      );
    }
  };

  const handleRemoveItem = async (collectionId: string) => {
    setError(null);
    try {
      await removeItems({
        groupId,
        collectionIds: [collectionId as Id<"collections">],
      });
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : t("importDialog.errorRemoveFailed"),
      );
    }
  };

  if (groupItems === undefined) {
    return (
      <div className="flex h-64 items-center justify-center">
        <p className="text-muted-foreground">{t("loadingItems")}</p>
      </div>
    );
  }

  return (
    <div className="p-6">
      {error && (
        <div className="mb-4 rounded-lg border border-destructive bg-destructive/10 p-3 text-sm text-destructive">
          {error}
        </div>
      )}

      {/* Import Existing Objects Dialog */}
      <Dialog open={isAddDialogOpen} onOpenChange={handleDialogOpenChange}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{t("importDialog.title")}</DialogTitle>
            <DialogDescription>
              {t("importDialog.description")}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>{t("importDialog.searchLabel")}</Label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder={t("importDialog.searchPlaceholder")}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9"
                />
              </div>
              {!isCollectionListComplete && collections.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  {t("importDialog.loadingObjects")}
                </p>
              ) : availableCollections.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  {searchQuery
                    ? t("importDialog.noMatches")
                    : t("importDialog.noAvailable")}
                </p>
              ) : (
                <div className="max-h-[200px] space-y-1 overflow-y-auto rounded-md border border-border/60 p-2">
                  {availableCollections.map((collection) => {
                    const isSelected = selectedCollectionIds.includes(
                      collection._id,
                    );
                    return (
                      <button
                        key={collection._id}
                        type="button"
                        onClick={() => {
                          if (isSelected) {
                            setSelectedCollectionIds((prev) =>
                              prev.filter((id) => id !== collection._id),
                            );
                          } else {
                            setSelectedCollectionIds((prev) => [
                              ...prev,
                              collection._id,
                            ]);
                          }
                        }}
                        className={`w-full rounded-md px-3 py-2 text-left text-sm transition-colors ${
                          isSelected
                            ? "bg-primary text-primary-foreground"
                            : "hover:bg-accent"
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <div>
                            <span className="font-medium">
                              {collection.accessionNumber}
                            </span>
                            <span className="ml-2 text-muted-foreground">
                              {collection.title}
                            </span>
                          </div>
                          {isSelected && <X className="size-4" />}
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
              {selectedCollectionIds.length > 0 && (
                <div className="space-y-2">
                  <Label className="text-sm font-medium">
                    {tRoot(
                      "untranslatedRecords.collections.detail.selectedCount",
                      {
                        count: selectedCollectionIds.length,
                      },
                    )}
                  </Label>
                  <div className="flex flex-wrap gap-2">
                    {selectedCollectionIds.map((id) => {
                      const collection = collections.find((c) => c._id === id);
                      return (
                        <div
                          key={id}
                          className="flex items-center gap-1 rounded-md bg-muted px-2 py-1 text-sm"
                        >
                          <span>
                            {collection?.accessionNumber} - {collection?.title}
                          </span>
                          <button
                            type="button"
                            onClick={() =>
                              setSelectedCollectionIds(
                                selectedCollectionIds.filter((i) => i !== id),
                              )
                            }
                            className="ml-1 hover:text-destructive"
                          >
                            <X className="size-3" />
                          </button>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => onAddDialogOpenChange(false)}
            >
              {common("cancel")}
            </Button>
            <Button onClick={handleAddItems}>
              {t("importDialog.importButton")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {groupItems.length === 0 ? (
        <div className="flex h-64 flex-col items-center justify-center gap-4">
          <p className="text-muted-foreground">{t("noItems")}</p>
          <div className="flex gap-2">
            <PermissionGate permission="collections.update">
              <Button onClick={() => onAddDialogOpenChange(true)}>
                <FolderInput className="mr-2 size-4" />
                {t("importExisting")}
              </Button>
            </PermissionGate>
            <PermissionGate permission="collections.create">
              <Button variant="outline" asChild>
                <Link href={`/objects/new?collectionGroupId=${groupId}`}>
                  <PlusCircle className="mr-2 size-4" />
                  {t("newObject")}
                </Link>
              </Button>
            </PermissionGate>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          {groupItems.map((item) => (
            <CollectionListItem
              key={item._id}
              item={item}
              imageUrl={groupItemImageUrlMap.get(item.collectionId)}
              organizationId={organizationId}
              onRemove={() => handleRemoveItem(item.collectionId)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

type CollectionGroupItem = FunctionReturnType<
  typeof api.collectionGroups.listItems
>[number];

function CollectionListItem({
  item,
  imageUrl,
  onRemove,
}: {
  item: CollectionGroupItem;
  imageUrl?: string | null;
  organizationId: Id<"organizations">;
  onRemove?: () => void;
}) {
  const tRoot = useI18n();
  const t = useScopedI18n("collections");
  const common = useScopedI18n("common");

  return (
    <div className="flex items-center justify-between rounded-lg border border-border/60 bg-card p-4 transition-colors hover:bg-accent">
      <Link
        href={`/objects/${item.collectionId}`}
        className="flex flex-1 items-center gap-4"
      >
        <div className="flex size-16 flex-shrink-0 overflow-hidden rounded-md bg-muted">
          {imageUrl ? (
            <Image
              src={imageUrl}
              alt={item.title}
              fill
              sizes="64px"
              className="object-cover"
            />
          ) : (
            <div className="flex size-full items-center justify-center">
              <Building2 className="size-6 text-muted-foreground" />
            </div>
          )}
        </div>

        <div className="flex flex-1 items-center justify-between">
          <div className="flex-1">
            <h3 className="font-medium">{item.title}</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              {item.accessionNumber}
            </p>
            {item.description && (
              <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">
                {item.description}
              </p>
            )}
          </div>
          <div className="text-right">
            {item.status === "deaccessioned" ? (
              <span className="inline-flex items-center rounded-full bg-red-500/10 px-2 py-0.5 text-xs font-medium text-red-600">
                <Archive className="mr-1 size-3" />
                {tRoot("collections.kpi.deaccessioned")}
              </span>
            ) : (
              <p className="text-xs text-muted-foreground capitalize">
                {item.status}
              </p>
            )}
          </div>
        </div>
      </Link>
      <div className="ml-4 flex items-center gap-2">
        <Button variant="ghost" size="sm" asChild>
          <Link href={`/objects/${item.collectionId}`}>
            <ExternalLink className="size-4" />
          </Link>
        </Button>
        {onRemove && (
          <PermissionGate permission="collections.update">
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="ghost" size="sm">
                  <Trash2 className="size-4 text-destructive" />
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>{t("removeDialog.title")}</AlertDialogTitle>
                  <AlertDialogDescription>
                    {tRoot("untranslatedRecords.collections.remove.confirm", {
                      name: item.title,
                    })}
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>{common("cancel")}</AlertDialogCancel>
                  <AlertDialogAction onClick={onRemove}>
                    {t("removeDialog.remove")}
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </PermissionGate>
        )}
      </div>
    </div>
  );
}
