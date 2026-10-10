"use client";

import { api } from "@v1/backend/convex/_generated/api";
import type { Id } from "@v1/backend/convex/_generated/dataModel";
import { Button } from "@v1/ui/button";
import { Input } from "@v1/ui/input";
import { Label } from "@v1/ui/label";
import { useMutation } from "convex/react";
import { useState } from "react";
import { IdentifierAvailabilityHint } from "@/components/identifier-availability-hint";
import { PermissionGate } from "@/components/permission-gate";
import { useActionErrorMessage } from "@/hooks/use-action-error-message";
import { useIdentifierErrorMessage } from "@/hooks/use-identifier-error-message";
import { useScopedI18n } from "@/locales/client";

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
  const t = useScopedI18n("accessions.catalogNumber");
  const identifierMessage = useIdentifierErrorMessage();
  const actionErrorMessage = useActionErrorMessage();
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
      setMessage(t("selected"));
    } catch (err) {
      setError(identifierMessage(err) ?? actionErrorMessage(err, t("failed")));
    } finally {
      setIsWorking(false);
    }
  }

  return (
    <section className="mx-6 my-4 space-y-3 rounded-lg border border-white/10 p-4">
      <h2 className="font-medium">{t("title")}</h2>
      <p className="text-sm text-muted-foreground">
        {t("planned", {
          identifier: catalogIdentifier ?? accessionNumber,
          accessionNumber,
        })}
      </p>
      <PermissionGate permission="collections.update">
        <form action={handleAssign} className="space-y-2">
          <Label htmlFor="planned-catalog-identifier">{t("fieldLabel")}</Label>
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
            {t("select")}
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
