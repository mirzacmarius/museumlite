import { api } from "@v1/backend/convex/_generated/api";
import { fetchQuery } from "convex/nextjs";
import type { Metadata } from "next";
import { PortalAppShell } from "@/components/portal/portal-app-shell";
import { getWebI18n } from "@/locales/server";
import { PortalChrome } from "./portal-chrome";

interface LayoutProps {
  children: React.ReactNode;
  params: Promise<{ orgSlug: string; portalSlug: string }>;
}

export async function generateMetadata({
  params,
}: LayoutProps): Promise<Metadata> {
  const [{ orgSlug, portalSlug }, { t }] = await Promise.all([
    params,
    getWebI18n(),
  ]);

  try {
    const organization = await fetchQuery(api.organizations.getBySlug, {
      slug: orgSlug,
      portalSlug,
    });

    const name = organization?.name ?? orgSlug;

    return {
      title: `${t("public.portalTitle", { name })} | MuseumLite`,
      description: t("public.portalMetadata"),
      openGraph: {
        title: t("public.portalTitle", { name }),
        description: t("public.portalMetadata"),
        type: "website",
      },
    };
  } catch {
    return {
      title: `${t("public.portalTitle", { name: orgSlug })} | MuseumLite`,
      description: t("public.portalMetadata"),
    };
  }
}

export default function PortalLayout({ children }: LayoutProps) {
  return (
    <PortalAppShell>
      <PortalChrome>{children}</PortalChrome>
    </PortalAppShell>
  );
}
