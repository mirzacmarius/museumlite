import type { Metadata } from "next";
import { getI18n } from "@/locales/server";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getI18n();

  return {
    title: t("invitePage.heading"),
    description: t("invitePage.description"),
  };
}

export default function InviteLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
