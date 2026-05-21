"use client";

import { useScopedI18n } from "@/locales/client";
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
import { Textarea } from "@v1/ui/textarea";
import { Loader2 } from "lucide-react";
import type { NewAcquisitionRequestForm, Priority } from "./types";

interface NewAcquisitionRequestDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  newRequest: NewAcquisitionRequestForm;
  onNewRequestChange: (
    updater: (prev: NewAcquisitionRequestForm) => NewAcquisitionRequestForm,
  ) => void;
  isProcessing: boolean;
  onSubmit: () => void;
}

export function NewAcquisitionRequestDialog({
  open,
  onOpenChange,
  newRequest,
  onNewRequestChange,
  isProcessing,
  onSubmit,
}: NewAcquisitionRequestDialogProps) {
  const t = useScopedI18n("library.placeholders");
  const tAcq = useScopedI18n("library.acquisitions");

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{tAcq("form.title")}</DialogTitle>
          <DialogDescription>{tAcq("form.description")}</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>{tAcq("form.titleLabel")}</Label>
            <Input
              value={newRequest.title}
              onChange={(e) =>
                onNewRequestChange((prev) => ({
                  ...prev,
                  title: e.target.value,
                }))
              }
              placeholder={t("bookTitle")}
            />
          </div>
          <div className="space-y-2">
            <Label>{tAcq("form.authors")}</Label>
            <Input
              value={newRequest.authors}
              onChange={(e) =>
                onNewRequestChange((prev) => ({
                  ...prev,
                  authors: e.target.value,
                }))
              }
              placeholder={t("commaSeparatedAuthors")}
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>{tAcq("form.isbn")}</Label>
              <Input
                value={newRequest.isbn}
                onChange={(e) =>
                  onNewRequestChange((prev) => ({
                    ...prev,
                    isbn: e.target.value,
                  }))
                }
                placeholder={t("isbn")}
              />
            </div>
            <div className="space-y-2">
              <Label>{tAcq("form.publisher")}</Label>
              <Input
                value={newRequest.publisher}
                onChange={(e) =>
                  onNewRequestChange((prev) => ({
                    ...prev,
                    publisher: e.target.value,
                  }))
                }
                placeholder={t("publisher")}
              />
            </div>
          </div>
          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label>{tAcq("form.priority")}</Label>
              <Select
                value={newRequest.priority}
                onValueChange={(value: Priority) =>
                  onNewRequestChange((prev) => ({ ...prev, priority: value }))
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="low">{tAcq("priority.low")}</SelectItem>
                  <SelectItem value="normal">
                    {tAcq("priority.normal")}
                  </SelectItem>
                  <SelectItem value="high">{tAcq("priority.high")}</SelectItem>
                  <SelectItem value="urgent">
                    {tAcq("priority.urgent")}
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>{tAcq("form.quantity")}</Label>
              <Input
                type="number"
                min="1"
                value={newRequest.quantity}
                onChange={(e) =>
                  onNewRequestChange((prev) => ({
                    ...prev,
                    quantity: e.target.value,
                  }))
                }
              />
            </div>
            <div className="space-y-2">
              <Label>{tAcq("form.estPrice")}</Label>
              <Input
                type="number"
                step="0.01"
                value={newRequest.estimatedPrice}
                onChange={(e) =>
                  onNewRequestChange((prev) => ({
                    ...prev,
                    estimatedPrice: e.target.value,
                  }))
                }
                placeholder={tAcq("form.estPricePlaceholder")}
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label>{tAcq("form.reason")}</Label>
            <Textarea
              value={newRequest.reason}
              onChange={(e) =>
                onNewRequestChange((prev) => ({
                  ...prev,
                  reason: e.target.value,
                }))
              }
              placeholder={t("whyNeeded")}
              rows={3}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {tAcq("form.cancel")}
          </Button>
          <Button
            onClick={onSubmit}
            disabled={isProcessing || !newRequest.title.trim()}
          >
            {isProcessing && <Loader2 className="mr-2 size-4 animate-spin" />}
            {tAcq("submitRequest")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
