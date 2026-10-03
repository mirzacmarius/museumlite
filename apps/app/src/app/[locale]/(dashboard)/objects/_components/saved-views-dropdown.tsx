"use client";

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
import { ClientRelativeTime } from "@/components/client-date";
import { useCurrentLocale, useI18n } from "@/locales/client";

interface ObjectFilters {
  search: string;
  status: "active" | "deaccessioned" | "all";
  objectType: string;
  culture: string;
  period: string;
  materials: string;
  collectionGroupId: string;
  locationIds: string[];
  catalogedFrom: string;
  catalogedTo: string;
}

interface SavedViewsDropdownProps {
  organizationId: Id<"organizations">;
  currentFilters: ObjectFilters;
  onApplyView: (filters: ObjectFilters) => void;
}

interface EditingSavedView {
  id: Id<"savedViews">;
  name: string;
}

interface SavedViewDialogsProps {
  saveDialogOpen: boolean;
  viewName: string;
  isDefault: boolean;
  editingView: EditingSavedView | null;
  onSaveDialogOpenChange: (open: boolean) => void;
  onViewNameChange: (name: string) => void;
  onDefaultChange: (isDefault: boolean) => void;
  onEditingViewNameChange: (name: string) => void;
  onCloseEditingView: () => void;
  onSave: () => void;
  onUpdate: () => void;
}

export function SavedViewsDropdown({
  organizationId,
  currentFilters,
  onApplyView,
}: SavedViewsDropdownProps) {
  const tRoot = useI18n();
  const [saveDialogOpen, setSaveDialogOpen] = useState(false);
  const [viewName, setViewName] = useState("");
  const [isDefault, setIsDefault] = useState(false);
  const [editingView, setEditingView] = useState<EditingSavedView | null>(null);
  const hasLoadedDefault = useRef(false);
  const onApplyViewRef = useRef(onApplyView);
  onApplyViewRef.current = onApplyView;
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
        ) as Partial<ObjectFilters> & { locationId?: string };
        onApplyViewRef.current({
          search: filters.search || "",
          status: filters.status || "all",
          objectType: filters.objectType || "",
          culture: filters.culture || "",
          period: filters.period || "",
          materials: filters.materials || "",
          collectionGroupId: filters.collectionGroupId || "",
          locationIds:
            filters.locationIds ??
            (filters.locationId ? [filters.locationId] : []),
          catalogedFrom: filters.catalogedFrom || "",
          catalogedTo: filters.catalogedTo || "",
        });
      } catch {
        void 0;
      }
    }
  }, [defaultView]);

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
      toast.success(tRoot("untranslatedRecords.objects.savedViews.saved"));
      setSaveDialogOpen(false);
      setViewName("");
      setIsDefault(false);
    } catch {
      toast.error(tRoot("untranslatedRecords.objects.savedViews.failedSave"));
    }
  };

  const handleApply = async (view: {
    _id: Id<"savedViews">;
    filters: string;
  }) => {
    try {
      const filters = JSON.parse(view.filters) as Partial<ObjectFilters> & {
        locationId?: string;
      };
      onApplyView({
        search: filters.search || "",
        status: filters.status || "all",
        objectType: filters.objectType || "",
        culture: filters.culture || "",
        period: filters.period || "",
        materials: filters.materials || "",
        collectionGroupId: filters.collectionGroupId || "",
        locationIds:
          filters.locationIds ??
          (filters.locationId ? [filters.locationId] : []),
        catalogedFrom: filters.catalogedFrom || "",
        catalogedTo: filters.catalogedTo || "",
      });
      await markUsed({ viewId: view._id });
    } catch {
      toast.error(
        tRoot("untranslatedRecords.objects.savedViews.invalidFilters"),
      );
    }
  };

  const handleDelete = async (viewId: Id<"savedViews">) => {
    try {
      await removeView({ viewId });
      toast.success(tRoot("untranslatedRecords.objects.savedViews.deleted"));
    } catch {
      toast.error(tRoot("untranslatedRecords.objects.savedViews.failedDelete"));
    }
  };

  const handleUpdate = async () => {
    if (!editingView?.name.trim()) return;
    try {
      await updateView({
        viewId: editingView.id,
        name: editingView.name.trim(),
      });
      toast.success(tRoot("untranslatedRecords.objects.savedViews.updated"));
      setEditingView(null);
    } catch {
      toast.error(tRoot("untranslatedRecords.objects.savedViews.failedUpdate"));
    }
  };

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline">
            <Bookmark className="mr-2 size-4" />
            {tRoot("untranslatedRecords.objects.forms.savedViews")}
            <ChevronDown className="ml-2 size-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-64">
          {savedViews?.length === 0 && (
            <div className="px-2 py-4 text-center text-sm text-muted-foreground">
              {tRoot("untranslatedRecords.objects.forms.noSavedViews")}
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
                      {tRoot("untranslatedRecords.objects.forms.used")}{" "}
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
                    if (
                      confirm(
                        tRoot(
                          "untranslatedRecords.objects.savedViews.confirmDelete",
                        ),
                      )
                    ) {
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
            {tRoot("untranslatedRecords.objects.forms.saveCurrentView")}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <SavedViewDialogs
        saveDialogOpen={saveDialogOpen}
        viewName={viewName}
        isDefault={isDefault}
        editingView={editingView}
        onSaveDialogOpenChange={setSaveDialogOpen}
        onViewNameChange={setViewName}
        onDefaultChange={setIsDefault}
        onEditingViewNameChange={(name) =>
          setEditingView(editingView ? { ...editingView, name } : null)
        }
        onCloseEditingView={() => setEditingView(null)}
        onSave={handleSave}
        onUpdate={handleUpdate}
      />
    </>
  );
}

function SavedViewDialogs({
  saveDialogOpen,
  viewName,
  isDefault,
  editingView,
  onSaveDialogOpenChange,
  onViewNameChange,
  onDefaultChange,
  onEditingViewNameChange,
  onCloseEditingView,
  onSave,
  onUpdate,
}: SavedViewDialogsProps) {
  const tRoot = useI18n();

  return (
    <>
      <Dialog open={saveDialogOpen} onOpenChange={onSaveDialogOpenChange}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {tRoot("untranslatedRecords.objects.forms.saveCurrentView")}
            </DialogTitle>
            <DialogDescription className="sr-only">
              {tRoot("untranslatedRecords.objects.forms.nameSaveCurrentView")}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="viewName">
                {tRoot("untranslatedRecords.objects.forms.viewName")}
              </Label>
              <Input
                id="viewName"
                value={viewName}
                onChange={(event) => onViewNameChange(event.target.value)}
                placeholder={tRoot(
                  "untranslatedRecords.objects.forms.savedViewNameExample",
                )}
                onKeyDown={(event) => {
                  if (event.key === "Enter" && viewName.trim()) {
                    onSave();
                  }
                }}
              />
            </div>
            <div className="flex items-center gap-2">
              <Checkbox
                id="isDefault"
                checked={isDefault}
                onCheckedChange={(checked) => onDefaultChange(checked === true)}
              />
              <Label htmlFor="isDefault" className="cursor-pointer">
                {tRoot("untranslatedRecords.objects.forms.setAsDefaultView")}
              </Label>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => onSaveDialogOpenChange(false)}
            >
              {tRoot("objects.form.actions.cancel")}
            </Button>
            <Button onClick={onSave} disabled={!viewName.trim()}>
              {tRoot("untranslatedRecords.objects.forms.saveView")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!editingView} onOpenChange={onCloseEditingView}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {tRoot("untranslatedRecords.objects.forms.editView")}
            </DialogTitle>
            <DialogDescription className="sr-only">
              {tRoot("untranslatedRecords.objects.forms.renameSavedView")}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="editViewName">
                {tRoot("untranslatedRecords.objects.forms.viewName")}
              </Label>
              <Input
                id="editViewName"
                value={editingView?.name || ""}
                onChange={(event) =>
                  onEditingViewNameChange(event.target.value)
                }
                onKeyDown={(event) => {
                  if (event.key === "Enter" && editingView?.name.trim()) {
                    onUpdate();
                  }
                }}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={onCloseEditingView}>
              {tRoot("objects.form.actions.cancel")}
            </Button>
            <Button onClick={onUpdate} disabled={!editingView?.name.trim()}>
              {tRoot("objects.form.actions.save")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
