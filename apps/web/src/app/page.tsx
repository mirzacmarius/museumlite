import type { Metadata } from "next";
import { CTASection } from "@/components/landing/cta-section";
import { FaqsSectionEfferd } from "@/components/landing/faqs-section-efferd";
import { FeaturesGrid } from "@/components/landing/features-grid";
import { HeroSection } from "@/components/landing/hero-section";
import { PricingSection } from "@/components/landing/pricing-section";
import { UseCases } from "@/components/landing/use-cases";
import { VisualShowcase } from "@/components/landing/visual-showcase";

export const metadata: Metadata = {
  title: "MuseumLite - Museum Collection Management Software",
  description:
    "Complete collection management for museums, galleries, and collectors. Track accessions, manage locations, handle loans, and publish your collection online.",
};

export default function Page() {
  return (
    <div className="min-h-screen w-full">
      <HeroSection />
      <FeaturesGrid />
      <UseCases />
      <VisualShowcase />
      <PricingSection />
      <FaqsSectionEfferd />
      <CTASection />
    </div>
  );
}
