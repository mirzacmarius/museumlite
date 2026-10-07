"use client";

import { api } from "@v1/backend/convex/_generated/api";
import type { Id } from "@v1/backend/convex/_generated/dataModel";
import { Button } from "@v1/ui/button";
import { Input } from "@v1/ui/input";
import { Label } from "@v1/ui/label";
import { useMutation } from "convex/react";
import { ConvexError } from "convex/values";
import { useState } from "react";
import { IdentifierAvailabilityHint } from "@/components/identifier-availability-hint";
import { PermissionGate } from "@/components/permission-gate";

export function AccessionCatalogIdentifier({
  accessionId,
  organizationId,
  accessionNumber,
  catalogIdentifier,
}: {
  accessionId: Id<"accessions">;
  organizationId: Id<"organizations">;
  accessionNumber: string;
  catalogIdentifier?: string;
}) {
  const assign = useMutation(api.identifiers.assignCatalogIdentifier);
  const [draft, setDraft] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isWorking, setIsWorking] = useState(false);
  const identifier = draft ?? catalogIdentifier ?? accessionNumber;

  async function handleAssign() {
    setError(null);
    setIsWorking(true);
    try {
      await assign({ accessionId, identifier });
      setDraft(null);
      setMessage(
        "Catalog number selected. The permanent accession number is unchanged.",
      );
    } catch (err) {
      setError(
        err instanceof ConvexError && typeof err.data === "string"
          ? err.data
          : err instanceof Error
            ? err.message
            : "Unable to select catalog number.",
      );
    } finally {
      setIsWorking(false);
    }
  }

  return (
    <section className="mx-6 my-4 space-y-3 rounded-lg border border-white/10 p-4">
      <h2 className="font-medium">Catalog number on publication</h2>
      <p className="text-sm text-muted-foreground">
        Planned catalog number: {catalogIdentifier ?? accessionNumber}. The
        accession register number {accessionNumber} remains permanent. If the
        catalog already uses it, select a different catalog number for the new
        object. Availability is checked again when the object is published.
      </p>
      <PermissionGate permission="collections.update">
        <form action={handleAssign} className="space-y-2">
          <Label htmlFor="planned-catalog-identifier">
            Catalog identifier for the new object
          </Label>
          <Input
            id="planned-catalog-identifier"
            value={identifier}
            required
            maxLength={256}
            onChange={(event) => setDraft(event.target.value)}
          />
          <IdentifierAvailabilityHint
            organizationId={organizationId}
            register="catalog"
            identifier={identifier}
          />
          <Button type="submit" disabled={isWorking || !identifier.trim()}>
            Select catalog number
          </Button>
        </form>
      </PermissionGate>
      {message ? (
        <p role="status" className="text-sm">
          {message}
        </p>
      ) : null}
      {error ? (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      ) : null}
    </section>
  );
}
