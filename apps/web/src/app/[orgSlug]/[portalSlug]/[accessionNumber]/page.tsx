"use client";

import { PublicObjectDetail } from "@/components/public-object-detail";
import { api } from "@v1/backend/convex/_generated/api";
import { Button } from "@v1/ui/button";
import { useQuery } from "convex/react";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";

export default function PublicObjectPage() {
  const params = useParams();
  const orgSlug = params.orgSlug as string;
  const portalSlug = params.portalSlug as string;
  const accessionNumber = decodeURIComponent(params.accessionNumber as string);

  const basePath = `/${orgSlug}/${portalSlug}`;

  const object = useQuery(api.collections.getPublic, {
    organizationSlug: orgSlug,
    accessionNumber,
  });

  if (object === undefined) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-white/60">Loading…</p>
      </div>
    );
  }

  if (object === null) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center">
        <h1 className="text-2xl font-semibold text-white mb-2">Object Not Found</h1>
        <p className="text-white/60 mb-6">
          This object may not be publicly available
        </p>
        <Button asChild variant="outline" className="border-white/20">
          <Link href={basePath}>
            <ArrowLeft className="mr-2 size-4" />
            Back to Collection
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
            Back to Collection
          </Link>
        </div>

        <PublicObjectDetail object={object} />
      </div>
    </div>
  );
}
