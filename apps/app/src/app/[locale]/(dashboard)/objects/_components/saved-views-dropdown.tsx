"use client";

import { ClientRelativeTime } from "@/components/client-date";
import { useCurrentLocale } from "@/locales/client";
import { api } from "@v1/backend/convex/_generated/api";
import type { Id } from "@v1/backend/convex/_generated/dataModel";
import { Button } from "@v1/ui/button";
import { Checkbox } from "@v1/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@v1/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@v1/ui/dropdown-menu";
import { Input } from "@v1/ui/input";
import { Label } from "@v1/ui/label";
import { useMutation, useQuery } from "convex/react";
import {
  Bookmark,
  ChevronDown,
  Pencil,
  Plus,
  Star,
  Trash2,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";

interface ObjectFilters {
  search: string;
  status: "active" | "deaccessioned" | "all";
  objectType: string;
  culture: string;
  period: string;
  materials: string;
  collectionGroupId: string;
  locationId: string;
  catalogedFrom: string;
  catalogedTo: string;
}

interface SavedViewsDropdownProps {
  organizationId: Id<"organizations">;
  currentFilters: ObjectFilters;
  onApplyView: (filters: ObjectFilters) => void;
}

export function SavedViewsDropdown({
  organizationId,
  currentFilters,
  onApplyView,
}: SavedViewsDropdownProps) {
  const [saveDialogOpen, setSaveDialogOpen] = useState(false);
  const [viewName, setViewName] = useState("");
  const [isDefault, setIsDefault] = useState(false);
  const [editingView, setEditingView] = useState<{
    id: Id<"savedViews">;
    name: string;
  } | null>(null);
  const hasLoadedDefault = useRef(false);
  const locale = useCurrentLocale();

  const savedViews = useQuery(api.savedViews.list, {
    organizationId,
    module: "objects",
  });
  const defaultView = useQuery(api.savedViews.getDefault, {
    organizationId,
    module: "objects",
  });

  const createView = useMutation(api.savedViews.create);
  const updateView = useMutation(api.savedViews.update);
  const removeView = useMutation(api.savedViews.remove);
  const markUsed = useMutation(api.savedViews.markUsed);

  useEffect(() => {
    if (defaultView && !hasLoadedDefault.current) {
      hasLoadedDefault.current = true;
      try {
        const filters = JSON.parse(
          defaultView.filters,
        ) as Partial<ObjectFilters>;
        onApplyView({
          search: filters.search || "",
          status: filters.status || "all",
          objectType: filters.objectType || "",
          culture: filters.culture || "",
          period: filters.period || "",
          materials: filters.materials || "",
          collectionGroupId: filters.collectionGroupId || "",
          locationId: filters.locationId || "",
          catalogedFrom: filters.catalogedFrom || "",
          catalogedTo: filters.catalogedTo || "",
        });
      } catch {
        void 0;
      }
    }
  }, [defaultView, onApplyView]);

  const handleSave = async () => {
    if (!viewName.trim()) return;
    try {
      await createView({
        organizationId,
        name: viewName.trim(),
        module: "objects",
        filters: JSON.stringify(currentFilters),
        isDefault,
      });
      toast.success("View saved");
      setSaveDialogOpen(false);
      setViewName("");
      setIsDefault(false);
    } catch {
      toast.error("Failed to save view");
    }
  };

  const handleApply = async (view: {
    _id: Id<"savedViews">;
    filters: string;
  }) => {
    try {
      const filters = JSON.parse(view.filters) as Partial<ObjectFilters>;
      onApplyView({
        search: filters.search || "",
        status: filters.status || "all",
        objectType: filters.objectType || "",
        culture: filters.culture || "",
        period: filters.period || "",
        materials: filters.materials || "",
        collectionGroupId: filters.collectionGroupId || "",
        locationId: filters.locationId || "",
        catalogedFrom: filters.catalogedFrom || "",
        catalogedTo: filters.catalogedTo || "",
      });
      await markUsed({ viewId: view._id });
    } catch {
      toast.error("Invalid view filters");
    }
  };

  const handleDelete = async (viewId: Id<"savedViews">) => {
    try {
      await removeView({ viewId });
      toast.success("View deleted");
    } catch {
      toast.error("Failed to delete view");
    }
  };

  const handleUpdate = async () => {
    if (!editingView || !editingView.name.trim()) return;
    try {
      await updateView({
        viewId: editingView.id,
        name: editingView.name.trim(),
      });
      toast.success("View updated");
      setEditingView(null);
    } catch {
      toast.error("Failed to update view");
    }
  };

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline">
            <Bookmark className="mr-2 size-4" />
            Saved Views
            <ChevronDown className="ml-2 size-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-64">
          {savedViews?.length === 0 && (
            <div className="px-2 py-4 text-center text-sm text-muted-foreground">
              No saved views yet
            </div>
          )}
          {savedViews?.map((view) => (
            <DropdownMenuItem
              key={view._id}
              className="flex items-center justify-between"
              onSelect={(e) => e.preventDefault()}
            >
              <button
                type="button"
                className="flex-1 text-left"
                onClick={() => handleApply(view)}
              >
                <div className="flex flex-col gap-1">
                  <span className="flex items-center gap-2">
                    {view.isDefault && (
                      <Star className="size-3 fill-amber-500 text-amber-500" />
                    )}
                    {view.name}
                  </span>
                  {view.lastUsedAt && (
                    <span className="text-xs text-muted-foreground">
                      Used{" "}
                      <span className="lowercase">
                        <ClientRelativeTime
                          timestamp={view.lastUsedAt}
                          locale={locale}
                        />
                      </span>
                    </span>
                  )}
                </div>
              </button>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  className="p-1 text-muted-foreground hover:text-foreground"
                  onClick={(e) => {
                    e.stopPropagation();
                    setEditingView({ id: view._id, name: view.name });
                  }}
                >
                  <Pencil className="size-3" />
                </button>
                <button
                  type="button"
                  className="p-1 text-muted-foreground hover:text-destructive"
                  onClick={(e) => {
                    e.stopPropagation();
                    if (confirm("Delete this saved view?")) {
                      handleDelete(view._id);
                    }
                  }}
                >
                  <Trash2 className="size-3" />
                </button>
              </div>
            </DropdownMenuItem>
          ))}
          <DropdownMenuSeparator />
          <DropdownMenuItem onSelect={() => setSaveDialogOpen(true)}>
            <Plus className="mr-2 size-4" />
            Save Current View
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog open={saveDialogOpen} onOpenChange={setSaveDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Save Current View</DialogTitle>
            <DialogDescription className="sr-only">
              Name and save the current object filters as a reusable view.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="viewName">View Name</Label>
              <Input
                id="viewName"
                value={viewName}
                onChange={(e) => setViewName(e.target.value)}
                placeholder="e.g., Active paintings"
                onKeyDown={(e) => {
                  if (e.key === "Enter" && viewName.trim()) {
                    handleSave();
                  }
                }}
              />
            </div>
            <div className="flex items-center gap-2">
              <Checkbox
                id="isDefault"
                checked={isDefault}
                onCheckedChange={(checked) => setIsDefault(checked === true)}
              />
              <Label htmlFor="isDefault" className="cursor-pointer">
                Set as default view
              </Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSaveDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={!viewName.trim()}>
              Save View
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!editingView} onOpenChange={() => setEditingView(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit View</DialogTitle>
            <DialogDescription className="sr-only">
              Rename the selected saved object view.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="editViewName">View Name</Label>
              <Input
                id="editViewName"
                value={editingView?.name || ""}
                onChange={(e) =>
                  setEditingView(
                    editingView
                      ? { ...editingView, name: e.target.value }
                      : null,
                  )
                }
                onKeyDown={(e) => {
                  if (e.key === "Enter" && editingView?.name.trim()) {
                    handleUpdate();
                  }
                }}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingView(null)}>
              Cancel
            </Button>
            <Button onClick={handleUpdate} disabled={!editingView?.name.trim()}>
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
