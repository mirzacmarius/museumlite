"use client";

import { Button } from "@v1/ui/button";
import { Input } from "@v1/ui/input";
import { Label } from "@v1/ui/label";
import { Plus, X } from "lucide-react";
import { EditSection } from "../edit-section";
import type { CollectionFormTabProps, LinkEntry } from "../types";
import { createLinkEntryLocalId } from "../utils";

interface FormLinksSectionProps
  extends Pick<
    CollectionFormTabProps,
    "formData" | "updateField" | "placeholders"
  > {
  useLocalIds?: boolean;
}

export function FormLinksSection({
  formData,
  updateField,
  placeholders,
  useLocalIds = false,
}: FormLinksSectionProps) {
  function linkKey(link: LinkEntry, index: number) {
    if (useLocalIds && link.localId) return link.localId;
    return `link-${index}-${link.url}`;
  }

  return (
    <EditSection
      title="Links"
      description="Reference external resources, catalog entries, or supporting material."
    >
      <div className="space-y-3">
        {(formData.links || []).map((link, index) => (
          <div
            key={linkKey(link, index)}
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
                      localId: nextLinks[index]?.localId,
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
                    localId: nextLinks[index]?.localId,
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
            const newLink = useLocalIds
              ? { localId: createLinkEntryLocalId(), url: "", label: "" }
              : { url: "", label: "" };
            updateField("links", [...(formData.links || []), newLink]);
          }}
        >
          <Plus className="mr-2 size-4" />
          Add Link
        </Button>
      </div>
    </EditSection>
  );
}
