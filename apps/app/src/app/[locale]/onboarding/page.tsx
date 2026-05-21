import type { Metadata } from "next";
import { getI18n } from "@/locales/server";
import { OnboardingPageClient } from "./onboarding-page-client";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getI18n();

  return {
    title: t("onboardingPage.welcome"),
    description: t("onboardingPage.description"),
  };
}

export default function OnboardingPage() {
  return <OnboardingPageClient />;
}
