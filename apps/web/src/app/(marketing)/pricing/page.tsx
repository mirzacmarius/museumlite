import { PricingPlans } from "@/components/site/pricing-plans";
import { SiteFooter } from "@/components/site/footer";
import { Nav } from "@/components/site/nav";
import { PageHeader } from "@/components/site/section-label";
import { createPageMetadata } from "@/lib/metadata";

export const metadata = createPageMetadata({
  title: "Pricing",
  description:
    "Free, Pro, and Enterprise plans for museums and collections. Start free with no credit card — upgrade when you need loans, exhibitions, and more.",
  path: "/pricing",
});

const faqs = [
  [
    "Is the Free plan really free?",
    "Yes. Create an account, set up your organization, and use core catalog tools at no cost. Paid plans unlock advanced modules and higher limits when you are ready.",
  ],
  [
    "How do I upgrade to Pro or Enterprise?",
    "Sign up free, then open Settings → Billing in the app to choose Pro or Enterprise. Monthly and yearly billing are available.",
  ],
  [
    "Where is data hosted?",
    "EU (Frankfurt) by default. Additional regions can be discussed for Enterprise teams.",
  ],
  [
    "Do you offer non-profit pricing?",
    "We offer discounts for accredited non-profits on paid plans. Mention it when you request a tour or contact us.",
  ],
];

export default function PricingPage() {
  return (
    <>
      <Nav />
      <main id="main-content" className="bg-background text-foreground">
        <PageHeader
          eyebrow="Pricing"
          title={
            <>
              Start free,
              <br />
              <span className="text-gold">scale when you need to.</span>
            </>
          }
          lede="The same Free, Pro, and Enterprise plans you see in the app — transparent pricing with no per-object fees."
        />

        <section className="py-16 md:py-24 border-b border-border">
          <PricingPlans />
        </section>

        <section className="py-16 md:py-24">
          <div className="mx-auto max-w-3xl px-6 lg:px-10">
            <h2 className="font-display text-3xl text-ivory mb-10 text-center">
              Common questions
            </h2>
            <div className="divide-y divide-border border-y border-border">
              {faqs.map(([q, a]) => (
                <details key={q} className="group py-5">
                  <summary className="cursor-pointer list-none flex justify-between items-center gap-4 text-ivory hover:text-gold transition-colors">
                    <span className="font-display text-xl">{q}</span>
                    <span className="text-gold text-xl shrink-0 group-open:rotate-45 transition-transform">
                      +
                    </span>
                  </summary>
                  <p className="mt-3 text-muted-foreground leading-relaxed">{a}</p>
                </details>
              ))}
            </div>
          </div>
        </section>

        <SiteFooter />
      </main>
    </>
  );
}
