"use client";

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
import { Input } from "@v1/ui/input";
import { Label } from "@v1/ui/label";
import { Textarea } from "@v1/ui/textarea";
import { Edit } from "lucide-react";
import type React from "react";
import { useEffect, useState } from "react";
import { useScopedI18n } from "@/locales/client";

interface MediaEditDialogProps {
  media: {
    _id: string;
    caption?: string | null;
    photographer?: string | null;
    copyright?: string | null;
  };
  onUpdate: (updates: {
    caption?: string;
    photographer?: string;
    copyright?: string;
  }) => Promise<void>;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function MediaEditDialog({
  media,
  onUpdate,
  open,
  onOpenChange,
}: MediaEditDialogProps) {
  const common = useScopedI18n("common");
  const placeholders = useScopedI18n("objects.form.placeholders");
  const [formData, setFormData] = useState({
    caption: media.caption || "",
    photographer: media.photographer || "",
    copyright: media.copyright || "",
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    setFormData({
      caption: media.caption || "",
      photographer: media.photographer || "",
      copyright: media.copyright || "",
    });
  }, [media._id, media.caption, media.photographer, media.copyright]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      await onUpdate({
        caption: formData.caption || undefined,
        photographer: formData.photographer || undefined,
        copyright: formData.copyright || undefined,
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger asChild>
        <Button
          type="button"
          size="sm"
          variant="secondary"
          title={common("edit")}
        >
          <Edit className="size-4" />
        </Button>
      </DialogTrigger>
      <DialogContent>
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Edit Media Metadata</DialogTitle>
            <DialogDescription>
              Update the metadata for this media file.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="caption">Caption</Label>
              <Textarea
                id="caption"
                value={formData.caption}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, caption: e.target.value }))
                }
                placeholder={placeholders("caption")}
                rows={3}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="photographer">Photographer</Label>
              <Input
                id="photographer"
                value={formData.photographer}
                onChange={(e) =>
                  setFormData((prev) => ({
                    ...prev,
                    photographer: e.target.value,
                  }))
                }
                placeholder={placeholders("photographer")}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="copyright">Copyright</Label>
              <Input
                id="copyright"
                value={formData.copyright}
                onChange={(e) =>
                  setFormData((prev) => ({
                    ...prev,
                    copyright: e.target.value,
                  }))
                }
                placeholder={placeholders("copyright")}
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              {common("cancel")}
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? common("saving") : common("saveChanges")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
