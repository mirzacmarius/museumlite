"use client";

import { CollectionSelector } from "@/components/collection-selector";
import { useOrganization } from "@/components/organization-provider";
import { PermissionGate } from "@/components/permission-gate";
import { useScopedI18n } from "@/locales/client";
import { api } from "@v1/backend/convex/_generated/api";
import type { Id } from "@v1/backend/convex/_generated/dataModel";
import { Button } from "@v1/ui/button";
import { Checkbox } from "@v1/ui/checkbox";
import { DatePicker } from "@v1/ui/date-picker";
import { Input } from "@v1/ui/input";
import { Label } from "@v1/ui/label";
import { Textarea } from "@v1/ui/textarea";
import { useMutation, useQuery } from "convex/react";
import { AlertTriangle, ArrowLeft, Info, Save } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

export default function NewExhibitionPage() {
  const router = useRouter();
  const { currentOrganizationId } = useOrganization();
  const t = useScopedI18n("exhibitions");
  const createExhibition = useMutation(api.exhibitions.create);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    title: "",
    location: "",
    startDate: new Date(),
    endDate: undefined as Date | undefined,
    isCurrent: false,
    isLoan: false,
    loanVenue: "",
    notes: "",
    collectionId: undefined as string | undefined,
  });

  const conflicts = useQuery(
    api.exhibitions.checkScheduleConflicts,
    formData.collectionId
      ? {
          collectionId: formData.collectionId as Id<"collections">,
          startDate: formData.startDate.getTime(),
          endDate: formData.endDate?.getTime(),
        }
      : "skip",
  );

  if (!currentOrganizationId) {
    return (
      <div className="flex h-full w-full items-center justify-center bg-background">
        <p className="text-muted-foreground">
          Please select an organization to create exhibitions.
        </p>
      </div>
    );
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!formData.title.trim()) {
      setError(t("form.titleRequired"));
      return;
    }
    if (!formData.collectionId) {
      setError(t("form.selectObject"));
      return;
    }

    setIsSubmitting(true);
    try {
      await createExhibition({
        collectionId: formData.collectionId as Id<"collections">,
        title: formData.title,
        location: formData.location || undefined,
        startDate: formData.startDate.getTime(),
        endDate: formData.endDate ? formData.endDate.getTime() : undefined,
        isCurrent: formData.isCurrent,
        isLoan: formData.isLoan,
        loanVenue: formData.isLoan ? formData.loanVenue : undefined,
        notes: formData.notes || undefined,
      });
      router.push("/exhibitions");
    } catch (err) {
      console.error("Error creating exhibition:", err);
      setError(t("form.createError"));
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen w-full bg-background pb-20">
      <header className="sticky top-0 z-50 flex h-14 items-center justify-between border-b border-border bg-background/80 px-6 backdrop-blur-xl">
        <div className="flex items-center gap-2 text-xs">
          <Button variant="ghost" size="icon" className="h-7 w-7" asChild>
            <Link href="/exhibitions">
              <ArrowLeft className="h-4 w-4 text-muted-foreground" />
            </Link>
          </Button>
          <span className="text-muted-foreground">Exhibitions</span>
          <span className="text-muted-foreground">/</span>
          <span className="font-medium text-foreground">New Exhibition</span>
        </div>
      </header>

      <div className="mx-auto max-w-3xl px-6 py-8">
        <div className="mb-8">
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">
            Create Exhibition Record
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Record a new exhibition history for an object.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-8">
          {error && (
            <div className="rounded-lg border border-red-500/20 bg-red-500/10 p-4 text-sm text-red-400 flex items-center gap-2">
              <Info className="h-4 w-4" />
              {error}
            </div>
          )}

          {conflicts?.hasConflicts && (
            <div className="rounded-lg border border-amber-500/20 bg-amber-500/10 p-4">
              <div className="flex items-start gap-3">
                <AlertTriangle className="h-5 w-5 text-amber-400 flex-shrink-0 mt-0.5" />
                <div className="space-y-2">
                  <p className="text-sm font-medium text-amber-400">
                    Schedule Conflict Detected
                  </p>
                  <p className="text-xs text-amber-400/80">
                    This object is already scheduled during the selected dates:
                  </p>
                  <ul className="text-xs text-amber-400/80 space-y-1 ml-4 list-disc">
                    {conflicts.conflicts.map((c) => (
                      <li key={c.id}>
                        <span className="font-medium">{c.title}</span>
                        {" — "}
                        {new Date(c.startDate).toLocaleDateString()}
                        {c.endDate &&
                          ` to ${new Date(c.endDate).toLocaleDateString()}`}{" "}
                        <span className="capitalize">({c.status})</span>
                      </li>
                    ))}
                  </ul>
                  <p className="text-xs text-amber-400/60 mt-2">
                    You can still create the exhibition, but consider adjusting
                    dates to avoid overlap.
                  </p>
                </div>
              </div>
            </div>
          )}

          <div className="rounded-xl border border-border bg-muted/20 p-6 shadow-sm">
            <h2 className="text-sm font-semibold uppercase tracking-widest text-muted-foreground mb-6">
              Exhibition Details
            </h2>

            <div className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="title" className="text-muted-foreground">
                  Exhibition Title <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="title"
                  value={formData.title}
                  onChange={(e) =>
                    setFormData({ ...formData, title: e.target.value })
                  }
                  placeholder="e.g. Impressionism: A New Light"
                  className="bg-muted/50 border-border text-foreground placeholder:text-muted-foreground focus-visible:ring-ring"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <CollectionSelector
                    organizationId={currentOrganizationId}
                    value={formData.collectionId}
                    onValueChange={(value) =>
                      setFormData({ ...formData, collectionId: value })
                    }
                    label="Related Object"
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="location" className="text-muted-foreground">
                    Location / Gallery
                  </Label>
                  <Input
                    id="location"
                    value={formData.location}
                    onChange={(e) =>
                      setFormData({ ...formData, location: e.target.value })
                    }
                    placeholder="e.g. Gallery 4, Wing B"
                    className="bg-muted/50 border-border text-foreground placeholder:text-muted-foreground focus-visible:ring-ring"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <Label className="text-muted-foreground">
                    Start Date <span className="text-red-500">*</span>
                  </Label>
                  <DatePicker
                    date={formData.startDate}
                    onSelect={(date) =>
                      setFormData({
                        ...formData,
                        startDate: date || new Date(),
                      })
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-muted-foreground">End Date</Label>
                  <DatePicker
                    date={formData.endDate}
                    onSelect={(date) =>
                      setFormData({ ...formData, endDate: date })
                    }
                  />
                </div>
              </div>

              <div className="flex items-center space-x-2 rounded-lg border border-border bg-muted/50 p-4">
                <Checkbox
                  id="isCurrent"
                  checked={formData.isCurrent}
                  onCheckedChange={(checked) =>
                    setFormData({ ...formData, isCurrent: checked as boolean })
                  }
                />
                <div className="grid gap-1.5 leading-none">
                  <Label
                    htmlFor="isCurrent"
                    className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 text-foreground"
                  >
                    Currently on Display?
                  </Label>
                  <p className="text-xs text-muted-foreground">
                    Marking this as current will update the object's display
                    status.
                  </p>
                </div>
              </div>
            </div>
          </div>

          <div className="rounded-xl border border-border bg-muted/20 p-6 shadow-sm">
            <h2 className="text-sm font-semibold uppercase tracking-widest text-muted-foreground mb-6">
              Loan Information
            </h2>

            <div className="space-y-6">
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="isLoan"
                  checked={formData.isLoan}
                  onCheckedChange={(checked) =>
                    setFormData({ ...formData, isLoan: checked as boolean })
                  }
                />
                <Label htmlFor="isLoan" className="text-foreground">
                  Is this a loan exhibition?
                </Label>
              </div>

              {formData.isLoan && (
                <div className="space-y-2 animate-in fade-in slide-in-from-top-2">
                  <Label htmlFor="loanVenue" className="text-muted-foreground">
                    Loan Venue
                  </Label>
                  <Input
                    id="loanVenue"
                    value={formData.loanVenue}
                    onChange={(e) =>
                      setFormData({ ...formData, loanVenue: e.target.value })
                    }
                    placeholder="e.g. The British Museum"
                    className="bg-muted/50 border-border text-foreground placeholder:text-muted-foreground focus-visible:ring-ring"
                  />
                </div>
              )}
            </div>
          </div>

          <div className="rounded-xl border border-border bg-muted/20 p-6 shadow-sm">
            <h2 className="text-sm font-semibold uppercase tracking-widest text-muted-foreground mb-6">
              Notes
            </h2>
            <div className="space-y-2">
              <Textarea
                value={formData.notes}
                onChange={(e) =>
                  setFormData({ ...formData, notes: e.target.value })
                }
                placeholder="Curatorial notes, installation details..."
                className="min-h-[100px] bg-muted/50 border-border text-foreground placeholder:text-muted-foreground focus-visible:ring-ring resize-none"
              />
            </div>
          </div>

          <div className="flex justify-end gap-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => router.back()}
              className="border-border text-muted-foreground hover:bg-muted hover:text-foreground"
            >
              Cancel
            </Button>
            <PermissionGate permission="collections.update">
              <Button
                type="submit"
                disabled={isSubmitting}
                className="bg-zinc-100 text-zinc-900 hover:bg-zinc-200 dark:bg-zinc-100 dark:text-zinc-900"
              >
                <Save className="mr-2 h-4 w-4" />
                {isSubmitting
                  ? t("actions.creating")
                  : t("actions.createExhibition")}
              </Button>
            </PermissionGate>
          </div>
        </form>
      </div>
    </div>
  );
}
