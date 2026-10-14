"use client";

import { api } from "@v1/backend/convex/_generated/api";
import { useQuery } from "convex/react";
import { Building2 } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ClientCurrentYear } from "@/components/client-date";
import { LocaleSwitcher } from "@/components/site/locale-switcher";
import { useWebI18n } from "@/locales/provider";

export function PortalChrome({ children }: { children: React.ReactNode }) {
  const { t } = useWebI18n();
  const params = useParams();
  const orgSlug = params.orgSlug as string;
  const portalSlug = params.portalSlug as string;

  const organization = useQuery(api.organizations.getBySlug, {
    slug: orgSlug,
    portalSlug,
  });

  const orgTypeLabels: Record<string, string> = {
    museum: t("public.orgTypeMuseum"),
    gallery: t("public.orgTypeGallery"),
    library: t("public.orgTypeLibrary"),
    collector: t("public.orgTypePrivateCollection"),
  };

  return (
    <div className="fixed inset-0 z-50 bg-zinc-950 flex flex-col overflow-auto">
      <header className="border-b border-white/10 bg-zinc-950/80 backdrop-blur-sm sticky top-0 z-10">
        <div className="mx-auto max-w-7xl px-6 py-4">
          <div className="flex items-center justify-between">
            <Link
              href={`/${orgSlug}/${portalSlug}`}
              className="flex items-center gap-3 hover:opacity-80 transition-opacity"
            >
              <div className="size-10 rounded-lg bg-white/10 flex items-center justify-center overflow-hidden">
                {organization?.logoUrl ? (
                  <Image
                    src={organization.logoUrl}
                    alt={organization.name}
                    width={40}
                    height={40}
                    className="object-cover size-full"
                  />
                ) : (
                  <Building2 className="size-5 text-white/60" />
                )}
              </div>
              <div>
                <h1 className="font-semibold text-white">
                  {organization?.name ?? orgSlug}
                </h1>
                {organization?.type && (
                  <p className="text-xs text-white/50">
                    {orgTypeLabels[organization.type] ?? organization.type}
                  </p>
                )}
              </div>
            </Link>

            <div className="flex items-center gap-4 text-xs text-white/40">
              <LocaleSwitcher />
              <span>
                {t("common.poweredBy")}{" "}
                <a
                  href="https://museumlite.com"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-white/60 hover:text-white transition-colors"
                >
                  MuseumLite
                </a>
              </span>
            </div>
          </div>
        </div>
      </header>

      <main className="flex-1">{children}</main>

      <footer className="border-t border-white/10 py-6">
        <div className="mx-auto max-w-7xl px-6">
          <div className="flex items-center justify-between text-sm text-white/40">
            <p>
              © <ClientCurrentYear /> {organization?.name ?? orgSlug}
            </p>
            <a
              href="https://museumlite.com"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-white/60 transition-colors"
            >
              {t("common.poweredBy")} MuseumLite
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}
