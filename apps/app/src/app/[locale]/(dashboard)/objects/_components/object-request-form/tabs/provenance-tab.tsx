"use client";

import { Button } from "@v1/ui/button";
import { Checkbox } from "@v1/ui/checkbox";
import { Input } from "@v1/ui/input";
import { Label } from "@v1/ui/label";
import { Textarea } from "@v1/ui/textarea";
import { CheckCircle, Plus, X } from "lucide-react";
import { EditSection } from "../../collection-form-shared/edit-section";
import type {
  CollectionFormTabProps,
  OwnershipEntry,
} from "../../collection-form-shared/types";

export function ObjectRequestProvenanceTab({
  formData,
  updateField,
  placeholders,
}: CollectionFormTabProps) {
  return (
    <div className="space-y-8">
      <EditSection
        title="Provenance and history"
        description="Historical context and movement details that give the object its narrative."
      >
        <div className="grid gap-5 lg:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="provenance">Provenance</Label>
            <Textarea
              autoResize
              id="provenance"
              value={formData.provenance || ""}
              onChange={(event) =>
                updateField("provenance", event.target.value)
              }
              rows={5}
              placeholder={placeholders("provenance")}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="exhibitionHistory">Exhibition History</Label>
            <Textarea
              autoResize
              id="exhibitionHistory"
              value={formData.exhibitionHistory || ""}
              onChange={(event) =>
                updateField("exhibitionHistory", event.target.value)
              }
              rows={5}
              placeholder={placeholders("exhibitionHistory")}
            />
          </div>
        </div>
      </EditSection>

      <EditSection
        title="Ownership history"
        description="Document the chain of ownership entry by entry."
      >
        <div className="space-y-4">
          <div className="flex items-center justify-between gap-3">
            <p className="text-sm text-muted-foreground">
              Add dated entries with notes and verification details.
            </p>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => {
                const newEntry: OwnershipEntry = {
                  owner: "",
                  startYear: "",
                  endYear: "",
                  description: "",
                  verified: false,
                  verificationSource: "",
                };
                updateField("ownershipHistory", [
                  ...(formData.ownershipHistory || []),
                  newEntry,
                ]);
              }}
            >
              <Plus className="mr-2 size-4" />
              Add Entry
            </Button>
          </div>

          {(formData.ownershipHistory || []).length === 0 ? (
            <div className="flex h-28 items-center justify-center rounded-xl border border-dashed border-border/60">
              <p className="text-sm text-muted-foreground">
                No ownership history recorded.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {(formData.ownershipHistory || []).map((entry, index) => (
                <div
                  key={`ownership-${entry.owner || ""}-${entry.startYear || ""}-${entry.endYear || ""}`}
                  className="rounded-xl border border-border/60 bg-secondary/20 p-4"
                >
                  <div className="mb-4 flex items-start justify-between gap-4">
                    <div className="space-y-1">
                      <h3 className="text-sm font-medium">
                        Ownership entry {index + 1}
                      </h3>
                      <p className="text-xs text-muted-foreground">
                        Capture ownership dates, notes, and verification.
                      </p>
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="size-8 text-muted-foreground hover:text-destructive"
                      onClick={() => {
                        const updated = [...(formData.ownershipHistory || [])];
                        updated.splice(index, 1);
                        updateField("ownershipHistory", updated);
                      }}
                    >
                      <X className="size-4" />
                    </Button>
                  </div>

                  <div className="grid gap-4">
                    <div className="grid gap-4 md:grid-cols-3">
                      <div className="md:col-span-1">
                        <Label htmlFor={`owner-${index}`}>
                          Owner <span className="text-red-500">*</span>
                        </Label>
                        <Input
                          id={`owner-${index}`}
                          value={entry.owner}
                          onChange={(event) => {
                            const updated = [
                              ...(formData.ownershipHistory || []),
                            ];
                            updated[index] = {
                              ...entry,
                              owner: event.target.value,
                            };
                            updateField("ownershipHistory", updated);
                          }}
                          placeholder="Owner name"
                        />
                      </div>
                      <div>
                        <Label htmlFor={`startYear-${index}`}>From</Label>
                        <Input
                          id={`startYear-${index}`}
                          value={entry.startYear || ""}
                          onChange={(event) => {
                            const updated = [
                              ...(formData.ownershipHistory || []),
                            ];
                            updated[index] = {
                              ...entry,
                              startYear: event.target.value,
                            };
                            updateField("ownershipHistory", updated);
                          }}
                          placeholder="e.g., 1920"
                        />
                      </div>
                      <div>
                        <Label htmlFor={`endYear-${index}`}>To</Label>
                        <Input
                          id={`endYear-${index}`}
                          value={entry.endYear || ""}
                          onChange={(event) => {
                            const updated = [
                              ...(formData.ownershipHistory || []),
                            ];
                            updated[index] = {
                              ...entry,
                              endYear: event.target.value,
                            };
                            updateField("ownershipHistory", updated);
                          }}
                          placeholder="e.g., 1985 or Present"
                        />
                      </div>
                    </div>

                    <div>
                      <Label htmlFor={`description-${index}`}>Notes</Label>
                      <Textarea
                        id={`description-${index}`}
                        value={entry.description || ""}
                        onChange={(event) => {
                          const updated = [
                            ...(formData.ownershipHistory || []),
                          ];
                          updated[index] = {
                            ...entry,
                            description: event.target.value,
                          };
                          updateField("ownershipHistory", updated);
                        }}
                        rows={2}
                        placeholder="Ownership notes"
                      />
                    </div>

                    <div className="flex flex-wrap items-center gap-4">
                      <div className="flex items-center gap-2">
                        <Checkbox
                          id={`verified-${index}`}
                          checked={entry.verified ?? false}
                          onCheckedChange={(checked) => {
                            const updated = [
                              ...(formData.ownershipHistory || []),
                            ];
                            updated[index] = {
                              ...entry,
                              verified: checked === true,
                            };
                            updateField("ownershipHistory", updated);
                          }}
                        />
                        <Label
                          htmlFor={`verified-${index}`}
                          className="flex items-center gap-1 text-sm font-normal"
                        >
                          <CheckCircle className="size-3 text-green-500" />
                          Verified
                        </Label>
                      </div>

                      {entry.verified ? (
                        <div className="flex-1">
                          <Input
                            value={entry.verificationSource || ""}
                            onChange={(event) => {
                              const updated = [
                                ...(formData.ownershipHistory || []),
                              ];
                              updated[index] = {
                                ...entry,
                                verificationSource: event.target.value,
                              };
                              updateField("ownershipHistory", updated);
                            }}
                            placeholder="Verification source"
                            className="h-9 text-sm"
                          />
                        </div>
                      ) : null}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </EditSection>

      <EditSection
        title="Links"
        description="Reference external resources, catalog entries, or supporting material."
      >
        <div className="space-y-3">
          {(formData.links || []).map((link, index) => (
            <div
              key={`${link.url}-${link.label || ""}`}
              className="grid gap-3 rounded-xl border border-border/50 p-4 md:grid-cols-[1fr_1fr_auto]"
            >
              <div className="space-y-2">
                <Label htmlFor={`link-url-${index}`}>URL</Label>
                <Input
                  id={`link-url-${index}`}
                  type="url"
                  value={link.url}
                  onChange={(event) => {
                    const nextLinks = [...(formData.links || [])];
                    nextLinks[index] = {
                      ...nextLinks[index],
                      url: event.target.value,
                    };
                    updateField("links", nextLinks);
                  }}
                  onBlur={(event) => {
                    const nextLinks = [...(formData.links || [])];
                    if (event.target.value && !nextLinks[index]?.label) {
                      nextLinks[index] = {
                        url: nextLinks[index]?.url || "",
                        label: event.target.value,
                      };
                      updateField("links", nextLinks);
                    }
                  }}
                  placeholder="https://example.com"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor={`link-label-${index}`}>Label</Label>
                <Input
                  id={`link-label-${index}`}
                  value={link.label || ""}
                  onChange={(event) => {
                    const nextLinks = [...(formData.links || [])];
                    nextLinks[index] = {
                      url: nextLinks[index]?.url || "",
                      label: event.target.value,
                    };
                    updateField("links", nextLinks);
                  }}
                  placeholder={placeholders("linkName")}
                />
              </div>
              {(formData.links || []).length > 1 ? (
                <div className="flex items-end">
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => {
                      const nextLinks = [...(formData.links || [])];
                      nextLinks.splice(index, 1);
                      updateField("links", nextLinks);
                    }}
                  >
                    <X className="size-4" />
                  </Button>
                </div>
              ) : null}
            </div>
          ))}

          <Button
            type="button"
            variant="outline"
            onClick={() => {
              updateField("links", [
                ...(formData.links || []),
                { url: "", label: "" },
              ]);
            }}
          >
            <Plus className="mr-2 size-4" />
            Add Link
          </Button>
        </div>
      </EditSection>
    </div>
  );
}
