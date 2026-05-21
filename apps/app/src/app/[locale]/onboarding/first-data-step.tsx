"use client";

import { useI18n } from "@/locales/client";
import { Button } from "@v1/ui/button";
import { Database, FolderPlus, Plus, Upload } from "lucide-react";
import Link from "next/link";

interface FirstDataStepProps {
  onSkip: () => void;
}

export function FirstDataStep({ onSkip }: FirstDataStepProps) {
  const t = useI18n();

  return (
    <div className="flex w-full flex-col items-center gap-6">
      <div className="flex flex-col items-center gap-2">
        <div className="mb-2 flex size-16 items-center justify-center rounded-full bg-primary/10">
          <Database className="size-8 text-primary" />
        </div>
        <h3 className="text-center text-2xl font-medium text-primary">
          {t("onboardingPage.dataTitle")}
        </h3>
        <p className="text-center text-base font-normal text-primary/60">
          {t("onboardingPage.dataDescription")}
        </p>
      </div>

      <div className="grid w-full gap-3">
        <Button asChild>
          <Link href="/objects/new">
            <Plus className="mr-2 size-4" />
            {t("onboardingPage.addFirstObject")}
          </Link>
        </Button>
        <Button variant="outline" asChild>
          <Link href="/collections/import">
            <Upload className="mr-2 size-4" />
            {t("onboardingPage.importObjects")}
          </Link>
        </Button>
        <Button variant="outline" asChild>
          <Link href="/collections/new">
            <FolderPlus className="mr-2 size-4" />
            {t("onboardingPage.createCollectionGroup")}
          </Link>
        </Button>
      </div>

      <Button variant="ghost" onClick={onSkip}>
        {t("onboardingPage.skipForNow")}
      </Button>
    </div>
  );
}
