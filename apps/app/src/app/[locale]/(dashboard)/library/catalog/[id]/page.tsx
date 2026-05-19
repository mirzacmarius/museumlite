"use client";

import { useOrganization } from "@/components/organization-provider";
import { useScopedI18n } from "@/locales/client";
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
import { Badge } from "@v1/ui/badge";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@v1/ui/select";
import { useMutation, useQuery } from "convex/react";
import {
  Archive,
  ArrowLeft,
  BookOpen,
  Check,
  Copy,
  Edit,
  Loader2,
  MapPin,
  Plus,
  Trash2,
} from "lucide-react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useState } from "react";

const CONDITION_VALUES = ["new", "excellent", "good", "fair", "poor"] as const;

type Condition = (typeof CONDITION_VALUES)[number];

export default function CatalogItemDetailPage() {
  const params = useParams();
  const { push } = useRouter();
  const itemId = params.id as Id<"libraryItems">;
  const { currentOrganizationId } = useOrganization();
  const t = useScopedI18n("library.placeholders");
  const tDetail = useScopedI18n("library.catalog.detail");
  const tCommon = useScopedI18n("common");
  const tLib = useScopedI18n("library");

  const getConditionLabel = (value: string) => {
    return tLib(`conditionOptions.${value}` as "conditionOptions.good");
  };

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

  const getStatusBadge = () => {
    switch (item.catalogStatus) {
      case "draft":
        return (
          <Badge variant="secondary">{tDetail("catalogStatus.draft")}</Badge>
        );
      case "published":
        return (
          <Badge variant="default" className="bg-green-500">
            {tDetail("catalogStatus.published")}
          </Badge>
        );
      case "archived":
        return (
          <Badge variant="outline">{tDetail("catalogStatus.archived")}</Badge>
        );
      default:
        return null;
    }
  };

  const getCopyStatusBadge = (status: string) => {
    switch (status) {
      case "available":
        return (
          <Badge variant="default" className="bg-green-500">
            {tDetail("copyStatus.available")}
          </Badge>
        );
      case "checked_out":
        return (
          <Badge variant="secondary">{tDetail("copyStatus.checkedOut")}</Badge>
        );
      case "on_hold":
        return (
          <Badge variant="default" className="bg-blue-500">
            {tDetail("copyStatus.onHold")}
          </Badge>
        );
      case "lost":
        return (
          <Badge variant="destructive">{tDetail("copyStatus.lost")}</Badge>
        );
      case "damaged":
        return (
          <Badge variant="default" className="bg-orange-500">
            {tDetail("copyStatus.damaged")}
          </Badge>
        );
      case "withdrawn":
        return (
          <Badge variant="outline">{tDetail("copyStatus.withdrawn")}</Badge>
        );
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  return (
    <div className="flex size-full bg-background px-6">
      <div className="z-10 mx-auto flex size-full max-w-screen-xl flex-col gap-6 py-6">
        {/* Header */}
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
                {getStatusBadge()}
              </div>
              {item.subtitle && (
                <p className="text-sm text-muted-foreground">{item.subtitle}</p>
              )}
            </div>
          </div>
          <div className="flex gap-2">
            {item.catalogStatus === "draft" && (
              <Button variant="outline" onClick={handlePublish}>
                <Check className="mr-2 size-4" />
                {tDetail("publish")}
              </Button>
            )}
            {item.catalogStatus === "published" && (
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="outline">
                    <Archive className="mr-2 size-4" />
                    {tDetail("archive")}
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>
                      {tDetail("archiveTitle")}
                    </AlertDialogTitle>
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
            )}
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

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          {/* Main Info */}
          <div className="space-y-6 lg:col-span-2">
            {/* Basic Details */}
            <div className="rounded-lg border border-border bg-card">
              <div className="border-b border-border p-6">
                <h2 className="text-lg font-medium">{tDetail("details")}</h2>
              </div>
              <div className="grid grid-cols-2 gap-4 p-6">
                <div>
                  <p className="text-sm text-muted-foreground">
                    {tDetail("type")}
                  </p>
                  <p className="font-medium capitalize">{item.itemType}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">
                    {tDetail("language")}
                  </p>
                  <p className="font-medium">{item.language}</p>
                </div>
                {item.authors.length > 0 && (
                  <div className="col-span-2">
                    <p className="text-sm text-muted-foreground">
                      {tDetail("authors")}
                    </p>
                    <p className="font-medium">{item.authors.join(", ")}</p>
                  </div>
                )}
                {item.publisher && (
                  <div>
                    <p className="text-sm text-muted-foreground">
                      {tDetail("publisher")}
                    </p>
                    <p className="font-medium">{item.publisher}</p>
                  </div>
                )}
                {item.publicationYear && (
                  <div>
                    <p className="text-sm text-muted-foreground">
                      {tDetail("year")}
                    </p>
                    <p className="font-medium">{item.publicationYear}</p>
                  </div>
                )}
                {item.isbn && (
                  <div>
                    <p className="text-sm text-muted-foreground">ISBN-10</p>
                    <p className="font-medium font-mono">{item.isbn}</p>
                  </div>
                )}
                {item.isbn13 && (
                  <div>
                    <p className="text-sm text-muted-foreground">ISBN-13</p>
                    <p className="font-medium font-mono">{item.isbn13}</p>
                  </div>
                )}
                {item.callNumber && (
                  <div>
                    <p className="text-sm text-muted-foreground">
                      {tDetail("callNumber")}
                    </p>
                    <p className="font-medium font-mono">{item.callNumber}</p>
                  </div>
                )}
                {item.pages && (
                  <div>
                    <p className="text-sm text-muted-foreground">
                      {tDetail("pages")}
                    </p>
                    <p className="font-medium">{item.pages}</p>
                  </div>
                )}
                {item.edition && (
                  <div>
                    <p className="text-sm text-muted-foreground">
                      {tDetail("edition")}
                    </p>
                    <p className="font-medium">{item.edition}</p>
                  </div>
                )}
                {item.series && (
                  <div>
                    <p className="text-sm text-muted-foreground">
                      {tDetail("series")}
                    </p>
                    <p className="font-medium">
                      {item.series}
                      {item.seriesNumber && ` #${item.seriesNumber}`}
                    </p>
                  </div>
                )}
              </div>
            </div>

            {/* Description */}
            {item.description && (
              <div className="rounded-lg border border-border bg-card">
                <div className="border-b border-border p-6">
                  <h2 className="text-lg font-medium">
                    {tDetail("description")}
                  </h2>
                </div>
                <div className="p-6">
                  <p className="whitespace-pre-wrap text-sm">
                    {item.description}
                  </p>
                </div>
              </div>
            )}

            {/* Subjects */}
            {(item.subjects?.length ?? 0) > 0 && (
              <div className="rounded-lg border border-border bg-card">
                <div className="border-b border-border p-6">
                  <h2 className="text-lg font-medium">{tDetail("subjects")}</h2>
                </div>
                <div className="flex flex-wrap gap-2 p-6">
                  {item.subjects?.map((subject) => (
                    <Badge key={subject} variant="secondary">
                      {subject}
                    </Badge>
                  ))}
                </div>
              </div>
            )}

            {/* Copies */}
            <div className="rounded-lg border border-border bg-card">
              <div className="flex items-center justify-between border-b border-border p-6">
                <div>
                  <h2 className="text-lg font-medium">{tDetail("copies")}</h2>
                  <p className="text-sm text-muted-foreground">
                    {tDetail("totalAvailable", {
                      total: item.totalCopies,
                      available: item.availableCopies,
                    })}
                  </p>
                </div>
                <Button onClick={() => setIsAddCopyOpen(true)}>
                  <Plus className="mr-2 size-4" />
                  {tDetail("addCopy")}
                </Button>
              </div>
              <div className="p-6">
                {copies === undefined ? (
                  <div className="flex justify-center py-8">
                    <Loader2 className="size-6 animate-spin text-muted-foreground" />
                  </div>
                ) : copies.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-8">
                    <Copy className="size-12 text-muted-foreground" />
                    <p className="mt-4 text-muted-foreground">
                      {tDetail("noCopiesYet")}
                    </p>
                    <Button
                      variant="outline"
                      className="mt-4"
                      onClick={() => setIsAddCopyOpen(true)}
                    >
                      <Plus className="mr-2 size-4" />
                      {tDetail("addFirstCopy")}
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {copies.map((copy) => (
                      <div
                        key={copy._id}
                        className="flex items-center justify-between rounded-lg border border-border p-4"
                      >
                        <div className="flex items-center gap-4">
                          <div>
                            <p className="font-mono text-sm font-medium">
                              {copy.barcode}
                            </p>
                            <div className="mt-1 flex items-center gap-2 text-sm text-muted-foreground">
                              <span>
                                {tDetail("copyNumber")}
                                {copy.copyNumber}
                              </span>
                              <span>|</span>
                              <span className="capitalize">
                                {getConditionLabel(copy.condition)}
                              </span>
                              {copy.shelfLocation && (
                                <>
                                  <span>|</span>
                                  <MapPin className="size-3" />
                                  <span>{copy.shelfLocation}</span>
                                </>
                              )}
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          {getCopyStatusBadge(copy.status)}
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button
                                variant="ghost"
                                size="sm"
                                disabled={copy.status === "checked_out"}
                              >
                                <Trash2 className="size-4 text-destructive" />
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>
                                  {tDetail("deleteCopyTitle")}
                                </AlertDialogTitle>
                                <AlertDialogDescription>
                                  {tDetail("deleteCopyDescription", {
                                    barcode: copy.barcode,
                                  })}
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>
                                  {tCommon("cancel")}
                                </AlertDialogCancel>
                                <AlertDialogAction
                                  onClick={() => handleDeleteCopy(copy._id)}
                                >
                                  {tCommon("delete")}
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Cover Image */}
            <div className="rounded-lg border border-border bg-card">
              <div className="p-6">
                {item.coverImageUrl ? (
                  <img
                    src={item.coverImageUrl}
                    alt={item.title}
                    className="w-full rounded-lg object-cover"
                  />
                ) : (
                  <div className="flex aspect-[2/3] items-center justify-center rounded-lg bg-muted">
                    <BookOpen className="size-16 text-muted-foreground" />
                  </div>
                )}
              </div>
            </div>

            {/* Circulation Info */}
            <div className="rounded-lg border border-border bg-card">
              <div className="border-b border-border p-6">
                <h2 className="text-lg font-medium">
                  {tDetail("circulation")}
                </h2>
              </div>
              <div className="space-y-4 p-6">
                <div>
                  <p className="text-sm text-muted-foreground">
                    {tDetail("canCirculate")}
                  </p>
                  <p className="font-medium">
                    {item.isCirculating
                      ? tDetail("canCirculateYes")
                      : tDetail("canCirculateNo")}
                  </p>
                </div>
                {item.loanPeriodDays && (
                  <div>
                    <p className="text-sm text-muted-foreground">
                      {tDetail("loanPeriod")}
                    </p>
                    <p className="font-medium">
                      {tDetail("loanPeriodDays", { days: item.loanPeriodDays })}
                    </p>
                  </div>
                )}
                {item.maxRenewals && (
                  <div>
                    <p className="text-sm text-muted-foreground">
                      {tDetail("maxRenewals")}
                    </p>
                    <p className="font-medium">{item.maxRenewals}</p>
                  </div>
                )}
              </div>
            </div>

            {/* Notes */}
            {(item.notes || item.internalNotes) && (
              <div className="rounded-lg border border-border bg-card">
                <div className="border-b border-border p-6">
                  <h2 className="text-lg font-medium">{tDetail("notes")}</h2>
                </div>
                <div className="space-y-4 p-6">
                  {item.notes && (
                    <div>
                      <p className="text-sm text-muted-foreground">
                        {tDetail("publicNotes")}
                      </p>
                      <p className="text-sm">{item.notes}</p>
                    </div>
                  )}
                  {item.internalNotes && (
                    <div>
                      <p className="text-sm text-muted-foreground">
                        {tDetail("internalNotes")}
                      </p>
                      <p className="text-sm">{item.internalNotes}</p>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Add Copy Dialog */}
        <Dialog open={isAddCopyOpen} onOpenChange={setIsAddCopyOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{tDetail("addCopyDialog.title")}</DialogTitle>
              <DialogDescription>
                {tDetail("addCopyDialog.description")}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="barcode">
                  {tDetail("addCopyDialog.barcodeLabel")}
                </Label>
                <div className="flex gap-2">
                  <Input
                    id="barcode"
                    value={newCopyBarcode}
                    onChange={(e) => setNewCopyBarcode(e.target.value)}
                    placeholder={t("enterOrGenerateBarcode")}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      if (generateBarcode) {
                        setNewCopyBarcode(generateBarcode);
                      }
                    }}
                  >
                    {tLib("generate")}
                  </Button>
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="condition">
                  {tDetail("addCopyDialog.conditionLabel")}
                </Label>
                <Select
                  value={newCopyCondition}
                  onValueChange={(value: Condition) =>
                    setNewCopyCondition(value)
                  }
                >
                  <SelectTrigger>
                    <SelectValue>
                      {getConditionLabel(newCopyCondition)}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {CONDITION_VALUES.map((value) => (
                      <SelectItem key={value} value={value}>
                        {getConditionLabel(value)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="shelfLocation">
                  {tDetail("addCopyDialog.shelfLocationLabel")}
                </Label>
                <Input
                  id="shelfLocation"
                  value={newCopyShelfLocation}
                  onChange={(e) => setNewCopyShelfLocation(e.target.value)}
                  placeholder={tDetail(
                    "addCopyDialog.shelfLocationPlaceholder",
                  )}
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsAddCopyOpen(false)}>
                {tLib("cancel")}
              </Button>
              <Button
                onClick={handleAddCopy}
                disabled={isAddingCopy || !newCopyBarcode.trim()}
              >
                {isAddingCopy ? (
                  <Loader2 className="mr-2 size-4 animate-spin" />
                ) : (
                  <Plus className="mr-2 size-4" />
                )}
                {tDetail("addCopyDialog.addCopyButton")}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
