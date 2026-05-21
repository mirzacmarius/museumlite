import { CTASection } from "@/components/landing/cta-section";
import { FaqsSectionEfferd } from "@/components/landing/faqs-section-efferd";
import { FeaturesGrid } from "@/components/landing/features-grid";
import { HeroSection } from "@/components/landing/hero-section";
import { PricingSection } from "@/components/landing/pricing-section";
import { UseCases } from "@/components/landing/use-cases";
import { VisualShowcase } from "@/components/landing/visual-showcase";

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
