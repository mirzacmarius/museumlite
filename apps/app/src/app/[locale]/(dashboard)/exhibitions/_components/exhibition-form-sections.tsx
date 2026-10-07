"use client";

import type { Id } from "@v1/backend/convex/_generated/dataModel";
import { Button } from "@v1/ui/button";
import { Checkbox } from "@v1/ui/checkbox";
import { DatePicker } from "@v1/ui/date-picker";
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
import { ArrowDown, ArrowUp, Plus, Trash2 } from "lucide-react";
import { CollectionSelector } from "@/components/collection-selector";
import { useScopedI18n } from "@/locales/client";
import type { ExhibitionFormData } from "./exhibition-form-types";

interface ExhibitionFormSectionsProps {
  formData: ExhibitionFormData;
  onFormDataChange: (
    updater: (prev: ExhibitionFormData) => ExhibitionFormData,
  ) => void;
  organizationId: Id<"organizations">;
}

function participantRowKey(
  participant: ExhibitionFormData["participants"][number],
  index: number,
) {
  return participant.collectionId ?? `draft-participant-${index}`;
}

export function ExhibitionFormSections({
  formData,
  onFormDataChange,
  organizationId,
}: ExhibitionFormSectionsProps) {
  const t = useScopedI18n("exhibitions");

  const setParticipantRole = (
    index: number,
    role: "featured" | "participant",
  ) => {
    onFormDataChange((prev) => ({
      ...prev,
      participants: prev.participants.map((item, itemIndex) => {
        if (itemIndex === index) return { ...item, role };
        if (role === "featured" && item.role === "featured") {
          return { ...item, role: "participant" };
        }
        return item;
      }),
    }));
  };

  return (
    <>
      <div className="rounded-xl border border-border bg-muted/20 p-6 shadow-sm">
        <h2 className="text-sm font-semibold uppercase tracking-widest text-muted-foreground mb-6">
          {t("form.exhibitionDetails")}
        </h2>

        <div className="space-y-6">
          <div className="space-y-2">
            <Label htmlFor="title" className="text-muted-foreground">
              {t("form.titleLabel")} <span className="text-red-500">*</span>
            </Label>
            <Input
              id="title"
              value={formData.title}
              onChange={(e) =>
                onFormDataChange((prev) => ({ ...prev, title: e.target.value }))
              }
              placeholder={t("placeholders.enterTitle")}
              className="bg-muted/50 border-border text-foreground placeholder:text-muted-foreground focus-visible:ring-ring"
            />
          </div>

          <div className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="location" className="text-muted-foreground">
                {t("form.locationLabel")}
              </Label>
              <Input
                id="location"
                value={formData.location}
                onChange={(e) =>
                  onFormDataChange((prev) => ({
                    ...prev,
                    location: e.target.value,
                  }))
                }
                placeholder={t("placeholders.selectLocation")}
                className="bg-muted/50 border-border text-foreground placeholder:text-muted-foreground focus-visible:ring-ring"
              />
            </div>
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label>{t("form.participantsLabel")}</Label>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() =>
                  onFormDataChange((prev) => ({
                    ...prev,
                    participants: [
                      ...prev.participants,
                      { role: "participant" },
                    ],
                  }))
                }
              >
                <Plus className="mr-2 size-4" />
                {t("form.addObject")}
              </Button>
            </div>
            {formData.participants.map((participant, index) => (
              <div
                key={participantRowKey(participant, index)}
                className="rounded-lg border border-white/10 p-3 space-y-3"
              >
                <CollectionSelector
                  organizationId={organizationId}
                  value={participant.collectionId}
                  onValueChange={(value) =>
                    onFormDataChange((prev) => ({
                      ...prev,
                      participants: prev.participants.map((item, itemIndex) =>
                        itemIndex === index
                          ? { ...item, collectionId: value }
                          : item,
                      ),
                    }))
                  }
                  label={`${t("form.objectNumber")} ${index + 1}`}
                  required
                />
                <div className="flex items-center gap-2">
                  <Select
                    value={participant.role}
                    onValueChange={(role: "featured" | "participant") =>
                      setParticipantRole(index, role)
                    }
                  >
                    <SelectTrigger className="w-40">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="participant">
                        {t("form.participantRole")}
                      </SelectItem>
                      <SelectItem value="featured">
                        {t("form.featuredRole")}
                      </SelectItem>
                    </SelectContent>
                  </Select>
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    disabled={index === 0}
                    aria-label={t("form.moveUp")}
                    onClick={() =>
                      onFormDataChange((prev) => {
                        const participants = [...prev.participants];
                        [participants[index - 1], participants[index]] = [
                          participants[index]!,
                          participants[index - 1]!,
                        ];
                        return { ...prev, participants };
                      })
                    }
                  >
                    <ArrowUp className="size-4" />
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    disabled={index === formData.participants.length - 1}
                    aria-label={t("form.moveDown")}
                    onClick={() =>
                      onFormDataChange((prev) => {
                        const participants = [...prev.participants];
                        [participants[index + 1], participants[index]] = [
                          participants[index]!,
                          participants[index + 1]!,
                        ];
                        return { ...prev, participants };
                      })
                    }
                  >
                    <ArrowDown className="size-4" />
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    disabled={formData.participants.length === 1}
                    aria-label={t("form.removeObject")}
                    onClick={() =>
                      onFormDataChange((prev) => ({
                        ...prev,
                        participants: prev.participants.filter(
                          (_, itemIndex) => itemIndex !== index,
                        ),
                      }))
                    }
                  >
                    <Trash2 className="size-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <DatePicker
              label={
                <>
                  {t("form.startDateLabel")}{" "}
                  <span className="text-red-500">*</span>
                </>
              }
              date={formData.startDate}
              onSelect={(date) =>
                onFormDataChange((prev) => ({
                  ...prev,
                  startDate: date ?? prev.startDate,
                }))
              }
            />
            <DatePicker
              label={t("form.endDateLabel")}
              date={formData.endDate}
              onSelect={(date) =>
                onFormDataChange((prev) => ({ ...prev, endDate: date }))
              }
            />
          </div>

          <div className="flex items-center gap-x-2 rounded-lg border border-border bg-muted/50 p-4">
            <Checkbox
              id="isCurrent"
              checked={formData.isCurrent}
              onCheckedChange={(checked) =>
                onFormDataChange((prev) => ({
                  ...prev,
                  isCurrent: checked as boolean,
                }))
              }
            />
            <div className="grid gap-1.5 leading-none">
              <Label
                htmlFor="isCurrent"
                className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 text-foreground"
              >
                {t("form.currentlyOnDisplay")}
              </Label>
              <p className="text-xs text-muted-foreground">
                {t("form.displayStatusHint")}
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="rounded-xl border border-border bg-muted/20 p-6 shadow-sm">
        <h2 className="text-sm font-semibold uppercase tracking-widest text-muted-foreground mb-6">
          {t("form.loanInfo")}
        </h2>

        <div className="space-y-6">
          <div className="flex items-center gap-x-2">
            <Checkbox
              id="isLoan"
              checked={formData.isLoan}
              onCheckedChange={(checked) =>
                onFormDataChange((prev) => ({
                  ...prev,
                  isLoan: checked as boolean,
                }))
              }
            />
            <Label htmlFor="isLoan" className="text-foreground">
              {t("form.isLoanExhibition")}
            </Label>
          </div>

          {formData.isLoan && (
            <div className="space-y-2 animate-in fade-in slide-in-from-top-2">
              <Label htmlFor="loanVenue" className="text-muted-foreground">
                {t("form.loanVenueLabel")}
              </Label>
              <Input
                id="loanVenue"
                value={formData.loanVenue}
                onChange={(e) =>
                  onFormDataChange((prev) => ({
                    ...prev,
                    loanVenue: e.target.value,
                  }))
                }
                placeholder={t("placeholders.selectLoanVenue")}
                className="bg-muted/50 border-border text-foreground placeholder:text-muted-foreground focus-visible:ring-ring"
              />
            </div>
          )}
        </div>
      </div>

      <div className="rounded-xl border border-border bg-muted/20 p-6 shadow-sm">
        <h2 className="text-sm font-semibold uppercase tracking-widest text-muted-foreground mb-6">
          {t("form.notesLabel")}
        </h2>
        <div className="space-y-2">
          <Textarea
            value={formData.notes}
            onChange={(e) =>
              onFormDataChange((prev) => ({ ...prev, notes: e.target.value }))
            }
            placeholder={t("placeholders.addNotes")}
            className="min-h-[100px] bg-muted/50 border-border text-foreground placeholder:text-muted-foreground focus-visible:ring-ring resize-none"
          />
        </div>
      </div>
    </>
  );
}
