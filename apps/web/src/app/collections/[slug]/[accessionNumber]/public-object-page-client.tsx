"use client";

import { api } from "@v1/backend/convex/_generated/api";
import { Button } from "@v1/ui/button";
import { useQuery } from "convex/react";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { PublicObjectDetail } from "@/components/public-object-detail";
import { useWebI18n } from "@/locales/provider";

export function PublicObjectPageClient() {
  const { t } = useWebI18n();
  const params = useParams();
  const slug = params.slug as string;
  const accessionNumber = decodeURIComponent(params.accessionNumber as string);

  const object = useQuery(api.collections.getPublic, {
    organizationSlug: slug,
    accessionNumber,
  });

  if (object === undefined) {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center">
        <p className="text-white/60">{t("common.loading")}</p>
      </div>
    );
  }

  if (object === null) {
    return (
      <div className="min-h-screen bg-zinc-950 flex flex-col items-center justify-center">
        <h1 className="text-2xl font-semibold text-white mb-2">
          {t("common.objectNotFound")}
        </h1>
        <p className="text-white/60 mb-6">{t("common.objectMayBePrivate")}</p>
        <Button asChild variant="outline" className="border-white/20">
          <Link href={`/collections/${slug}`}>
            <ArrowLeft className="mr-2 size-4" />
            {t("common.backCollection")}
          </Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-950">
      <div className="mx-auto max-w-7xl px-6 py-8">
        <div className="mb-8">
          <Link
            href={`/collections/${slug}`}
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
