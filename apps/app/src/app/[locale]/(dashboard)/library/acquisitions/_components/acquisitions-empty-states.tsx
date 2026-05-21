"use client";

import { useScopedI18n } from "@/locales/client";
import { Button } from "@v1/ui/button";
import { Building2, Library } from "lucide-react";
import Link from "next/link";

export function AcquisitionsNoOrganizationState() {
  const tAcq = useScopedI18n("library.acquisitions");
  const tLib = useScopedI18n("library");

  return (
    <div className="flex size-full items-center justify-center bg-background px-6 py-8">
      <div className="flex flex-col items-center gap-4 rounded-lg border border-border bg-card p-8">
        <Building2 className="size-12 text-muted-foreground" />
        <div className="text-center">
          <h3 className="text-lg font-semibold">{tAcq("noOrganization")}</h3>
          <p className="mt-2 text-sm text-muted-foreground">
            {tAcq("noOrganizationDescription")}
          </p>
        </div>
        <Button asChild>
          <Link href="/organizations/new">{tLib("createOrganization")}</Link>
        </Button>
      </div>
    </div>
  );
}

export function AcquisitionsSelectOrganizationState() {
  const tAcq = useScopedI18n("library.acquisitions");

  return (
    <div className="flex size-full items-center justify-center bg-background px-6 py-8">
      <div className="flex flex-col items-center gap-4 rounded-lg border border-border bg-card p-8">
        <Library className="size-12 text-muted-foreground" />
        <div className="text-center">
          <h3 className="text-lg font-semibold">
            {tAcq("selectOrganization")}
          </h3>
          <p className="mt-2 text-sm text-muted-foreground">
            {tAcq("selectOrganizationDescription")}
          </p>
        </div>
      </div>
    </div>
  );
}

export function AcquisitionsLibraryDisabledState() {
  const tAcq = useScopedI18n("library.acquisitions");
  const tLib = useScopedI18n("library");

  return (
    <div className="flex size-full items-center justify-center bg-background px-6 py-8">
      <div className="flex flex-col items-center gap-4 rounded-lg border border-border bg-card p-8">
        <Library className="size-12 text-muted-foreground" />
        <div className="text-center">
          <h3 className="text-lg font-semibold">{tAcq("notEnabled")}</h3>
          <p className="mt-2 text-sm text-muted-foreground">
            {tAcq("notEnabledDescription")}
          </p>
        </div>
        <Button asChild>
          <Link href="/settings/integrations">{tLib("enableIntegration")}</Link>
        </Button>
      </div>
    </div>
  );
}
