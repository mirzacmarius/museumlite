import type { Metadata } from "next";
import { getI18n } from "@/locales/server";
import { OrganizationDeletionCancelPageClient } from "./organization-deletion-cancel-page-client";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getI18n();

  return {
    title: t("organizationDeletionCancelPage.heading"),
    description: t("organizationDeletionCancelPage.description"),
  };
}

interface PageProps {
  params: Promise<{
    token: string;
    locale: string;
  }>;
}

export default function OrganizationDeletionCancelPage(props: PageProps) {
  return <OrganizationDeletionCancelPageClient params={props.params} />;
}
