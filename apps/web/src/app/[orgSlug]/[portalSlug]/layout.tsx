import { api } from "@v1/backend/convex/_generated/api";
import { fetchQuery } from "convex/nextjs";
import type { Metadata } from "next";
import { PortalAppShell } from "@/components/portal/portal-app-shell";
import { PortalChrome } from "./portal-chrome";

interface LayoutProps {
  children: React.ReactNode;
  params: Promise<{ orgSlug: string; portalSlug: string }>;
}

export async function generateMetadata({
  params,
}: LayoutProps): Promise<Metadata> {
  const { orgSlug, portalSlug } = await params;

  try {
    const organization = await fetchQuery(api.organizations.getBySlug, {
      slug: orgSlug,
    });

    const name = organization?.name ?? orgSlug;

    return {
      title: `${name} Portal | MuseumLite`,
      description: `Browse the public collection portal for ${name}.`,
      openGraph: {
        title: `${name} — ${portalSlug}`,
        description: `Public collection portal for ${name}`,
        type: "website",
      },
    };
  } catch {
    return {
      title: `${orgSlug} Portal | MuseumLite`,
      description: "Browse the public collection portal.",
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
