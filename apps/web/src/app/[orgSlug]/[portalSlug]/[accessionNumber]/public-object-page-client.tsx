"use client";

import { api } from "@v1/backend/convex/_generated/api";
import { Button } from "@v1/ui/button";
import { useQuery } from "convex/react";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { PublicObjectDetail } from "@/components/public-object-detail";
import { useWebI18n } from "@/locales/provider";

export function PublicPortalObjectPageClient() {
  const { t } = useWebI18n();
  const params = useParams();
  const orgSlug = params.orgSlug as string;
  const portalSlug = params.portalSlug as string;
  const accessionNumber = decodeURIComponent(params.accessionNumber as string);

  const basePath = `/${orgSlug}/${portalSlug}`;

  const object = useQuery(api.collections.getPublic, {
    organizationSlug: orgSlug,
    portalSlug,
    accessionNumber,
  });

  if (object === undefined) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-white/60">{t("common.loading")}</p>
      </div>
    );
  }

  if (object === null) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center">
        <h1 className="text-2xl font-semibold text-white mb-2">
          {t("common.objectNotFound")}
        </h1>
        <p className="text-white/60 mb-6">{t("common.objectMayBePrivate")}</p>
        <Button asChild variant="outline" className="border-white/20">
          <Link href={basePath}>
            <ArrowLeft className="mr-2 size-4" />
            {t("common.backCollection")}
          </Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      <div className="mx-auto max-w-7xl px-6 py-8">
        <div className="mb-8">
          <Link
            href={basePath}
            className="inline-flex items-center text-white/60 hover:text-white transition-colors"
          >
            <ArrowLeft className="mr-2 size-4" />
            {t("common.backCollection")}
          </Link>
        </div>

        <PublicObjectDetail object={object} />
      </div>
    </div>
  );
}
