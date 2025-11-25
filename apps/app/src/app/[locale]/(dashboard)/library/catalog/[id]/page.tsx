"use client";

import { useOrganization } from "@/components/organization-provider";
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

const CONDITION_OPTIONS = [
  { value: "new", label: "New" },
  { value: "excellent", label: "Excellent" },
  { value: "good", label: "Good" },
  { value: "fair", label: "Fair" },
  { value: "poor", label: "Poor" },
] as const;

type Condition = (typeof CONDITION_OPTIONS)[number]["value"];

export default function CatalogItemDetailPage() {
  const params = useParams();
  const router = useRouter();
  const itemId = params.id as Id<"libraryItems">;
  const { currentOrganizationId } = useOrganization();

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
    router.push("/library/catalog");
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
      <div className="flex h-full w-full items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (item === null) {
    return (
      <div className="flex h-full w-full items-center justify-center">
        <div className="text-center">
          <p className="text-muted-foreground">Item not found</p>
          <Button asChild className="mt-4">
            <Link href="/library/catalog">Back to Catalog</Link>
          </Button>
        </div>
      </div>
    );
  }

  const getStatusBadge = () => {
    switch (item.catalogStatus) {
      case "draft":
        return <Badge variant="secondary">Draft</Badge>;
      case "published":
        return (
          <Badge variant="default" className="bg-green-500">
            Published
          </Badge>
        );
      case "archived":
        return <Badge variant="outline">Archived</Badge>;
      default:
        return null;
    }
  };

  const getCopyStatusBadge = (status: string) => {
    switch (status) {
      case "available":
        return (
          <Badge variant="default" className="bg-green-500">
            Available
          </Badge>
        );
      case "checked_out":
        return <Badge variant="secondary">Checked Out</Badge>;
      case "on_hold":
        return (
          <Badge variant="default" className="bg-blue-500">
            On Hold
          </Badge>
        );
      case "lost":
        return <Badge variant="destructive">Lost</Badge>;
      case "damaged":
        return (
          <Badge variant="default" className="bg-orange-500">
            Damaged
          </Badge>
        );
      case "withdrawn":
        return <Badge variant="outline">Withdrawn</Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  return (
    <div className="flex h-full w-full bg-secondary px-6 dark:bg-black">
      <div className="z-10 mx-auto flex h-full w-full max-w-screen-xl flex-col gap-6 py-6">
        {/* Header */}
        <div className="flex items-center justify-between rounded-lg border border-border bg-card p-6 dark:bg-black">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="sm" asChild>
              <Link href="/library/catalog">
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back
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
                <Check className="mr-2 h-4 w-4" />
                Publish
              </Button>
            )}
            {item.catalogStatus === "published" && (
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="outline">
                    <Archive className="mr-2 h-4 w-4" />
                    Archive
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Archive Item</AlertDialogTitle>
                    <AlertDialogDescription>
                      Are you sure you want to archive this item? It will no
                      longer appear in the catalog.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction onClick={handleArchive}>
                      Archive
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            )}
            <Button variant="outline" asChild>
              <Link href={`/library/catalog/${itemId}/edit`}>
                <Edit className="mr-2 h-4 w-4" />
                Edit
              </Link>
            </Button>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="destructive">
                  <Trash2 className="mr-2 h-4 w-4" />
                  Delete
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Delete Item</AlertDialogTitle>
                  <AlertDialogDescription>
                    Are you sure you want to delete this item? This action
                    cannot be undone.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction onClick={handleDelete}>
                    Delete
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
            <div className="rounded-lg border border-border bg-card dark:bg-black">
              <div className="border-b border-border p-6">
                <h2 className="text-lg font-medium">Details</h2>
              </div>
              <div className="grid grid-cols-2 gap-4 p-6">
                <div>
                  <p className="text-sm text-muted-foreground">Type</p>
                  <p className="font-medium capitalize">{item.itemType}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Language</p>
                  <p className="font-medium">{item.language}</p>
                </div>
                {item.authors.length > 0 && (
                  <div className="col-span-2">
                    <p className="text-sm text-muted-foreground">Authors</p>
                    <p className="font-medium">{item.authors.join(", ")}</p>
                  </div>
                )}
                {item.publisher && (
                  <div>
                    <p className="text-sm text-muted-foreground">Publisher</p>
                    <p className="font-medium">{item.publisher}</p>
                  </div>
                )}
                {item.publicationYear && (
                  <div>
                    <p className="text-sm text-muted-foreground">Year</p>
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
                    <p className="text-sm text-muted-foreground">Call Number</p>
                    <p className="font-medium font-mono">{item.callNumber}</p>
                  </div>
                )}
                {item.pages && (
                  <div>
                    <p className="text-sm text-muted-foreground">Pages</p>
                    <p className="font-medium">{item.pages}</p>
                  </div>
                )}
                {item.edition && (
                  <div>
                    <p className="text-sm text-muted-foreground">Edition</p>
                    <p className="font-medium">{item.edition}</p>
                  </div>
                )}
                {item.series && (
                  <div>
                    <p className="text-sm text-muted-foreground">Series</p>
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
              <div className="rounded-lg border border-border bg-card dark:bg-black">
                <div className="border-b border-border p-6">
                  <h2 className="text-lg font-medium">Description</h2>
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
              <div className="rounded-lg border border-border bg-card dark:bg-black">
                <div className="border-b border-border p-6">
                  <h2 className="text-lg font-medium">Subjects</h2>
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
            <div className="rounded-lg border border-border bg-card dark:bg-black">
              <div className="flex items-center justify-between border-b border-border p-6">
                <div>
                  <h2 className="text-lg font-medium">Copies</h2>
                  <p className="text-sm text-muted-foreground">
                    {item.totalCopies} total, {item.availableCopies} available
                  </p>
                </div>
                <Button onClick={() => setIsAddCopyOpen(true)}>
                  <Plus className="mr-2 h-4 w-4" />
                  Add Copy
                </Button>
              </div>
              <div className="p-6">
                {copies === undefined ? (
                  <div className="flex justify-center py-8">
                    <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                  </div>
                ) : copies.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-8">
                    <Copy className="h-12 w-12 text-muted-foreground" />
                    <p className="mt-4 text-muted-foreground">
                      No copies added yet
                    </p>
                    <Button
                      variant="outline"
                      className="mt-4"
                      onClick={() => setIsAddCopyOpen(true)}
                    >
                      <Plus className="mr-2 h-4 w-4" />
                      Add First Copy
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
                              <span>Copy #{copy.copyNumber}</span>
                              <span>|</span>
                              <span className="capitalize">
                                {copy.condition}
                              </span>
                              {copy.shelfLocation && (
                                <>
                                  <span>|</span>
                                  <MapPin className="h-3 w-3" />
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
                                <Trash2 className="h-4 w-4 text-destructive" />
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Delete Copy</AlertDialogTitle>
                                <AlertDialogDescription>
                                  Are you sure you want to delete copy{" "}
                                  {copy.barcode}?
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancel</AlertDialogCancel>
                                <AlertDialogAction
                                  onClick={() => handleDeleteCopy(copy._id)}
                                >
                                  Delete
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
            <div className="rounded-lg border border-border bg-card dark:bg-black">
              <div className="p-6">
                {item.coverImageUrl ? (
                  <img
                    src={item.coverImageUrl}
                    alt={item.title}
                    className="w-full rounded-lg object-cover"
                  />
                ) : (
                  <div className="flex aspect-[2/3] items-center justify-center rounded-lg bg-muted">
                    <BookOpen className="h-16 w-16 text-muted-foreground" />
                  </div>
                )}
              </div>
            </div>

            {/* Circulation Info */}
            <div className="rounded-lg border border-border bg-card dark:bg-black">
              <div className="border-b border-border p-6">
                <h2 className="text-lg font-medium">Circulation</h2>
              </div>
              <div className="space-y-4 p-6">
                <div>
                  <p className="text-sm text-muted-foreground">Can Circulate</p>
                  <p className="font-medium">
                    {item.isCirculating ? "Yes" : "No (Reference Only)"}
                  </p>
                </div>
                {item.loanPeriodDays && (
                  <div>
                    <p className="text-sm text-muted-foreground">Loan Period</p>
                    <p className="font-medium">{item.loanPeriodDays} days</p>
                  </div>
                )}
                {item.maxRenewals && (
                  <div>
                    <p className="text-sm text-muted-foreground">
                      Max Renewals
                    </p>
                    <p className="font-medium">{item.maxRenewals}</p>
                  </div>
                )}
              </div>
            </div>

            {/* Notes */}
            {(item.notes || item.internalNotes) && (
              <div className="rounded-lg border border-border bg-card dark:bg-black">
                <div className="border-b border-border p-6">
                  <h2 className="text-lg font-medium">Notes</h2>
                </div>
                <div className="space-y-4 p-6">
                  {item.notes && (
                    <div>
                      <p className="text-sm text-muted-foreground">
                        Public Notes
                      </p>
                      <p className="text-sm">{item.notes}</p>
                    </div>
                  )}
                  {item.internalNotes && (
                    <div>
                      <p className="text-sm text-muted-foreground">
                        Internal Notes
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
              <DialogTitle>Add New Copy</DialogTitle>
              <DialogDescription>
                Add a new physical copy of this item to the library
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="barcode">Barcode *</Label>
                <div className="flex gap-2">
                  <Input
                    id="barcode"
                    value={newCopyBarcode}
                    onChange={(e) => setNewCopyBarcode(e.target.value)}
                    placeholder="Enter or generate barcode"
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
                    Generate
                  </Button>
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="condition">Condition *</Label>
                <Select
                  value={newCopyCondition}
                  onValueChange={(value: Condition) =>
                    setNewCopyCondition(value)
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CONDITION_OPTIONS.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="shelfLocation">Shelf Location</Label>
                <Input
                  id="shelfLocation"
                  value={newCopyShelfLocation}
                  onChange={(e) => setNewCopyShelfLocation(e.target.value)}
                  placeholder="e.g., A-12-3"
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsAddCopyOpen(false)}>
                Cancel
              </Button>
              <Button
                onClick={handleAddCopy}
                disabled={isAddingCopy || !newCopyBarcode.trim()}
              >
                {isAddingCopy ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Plus className="mr-2 h-4 w-4" />
                )}
                Add Copy
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
