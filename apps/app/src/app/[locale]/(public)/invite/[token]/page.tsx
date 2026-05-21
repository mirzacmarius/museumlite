import type { Metadata } from "next";
import { getI18n } from "@/locales/server";
import { InvitePageClient } from "./invite-page-client";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getI18n();

  return {
    title: t("invitePage.heading"),
    description: t("invitePage.description"),
  };
}

interface PageProps {
  params: Promise<{
    token: string;
    locale: string;
  }>;
}

export default function InvitePage(props: PageProps) {
  return <InvitePageClient params={props.params} />;
}
