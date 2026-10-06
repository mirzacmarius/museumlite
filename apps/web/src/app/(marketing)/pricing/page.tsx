import { SiteFooter } from "@/components/site/footer";
import { Nav } from "@/components/site/nav";
import { PricingPlans } from "@/components/site/pricing-plans";
import { PageHeader } from "@/components/site/section-label";
import { createPageMetadata } from "@/lib/metadata";
import { getWebI18n } from "@/locales/server";

export async function generateMetadata() {
  const { locale, t } = await getWebI18n();
  return createPageMetadata({
    title: t("marketing.pricing.title"),
    description: t("marketing.pricing.description"),
    path: "/pricing",
    locale,
  });
}

export default async function PricingPage() {
  const { t } = await getWebI18n();
  const faqs = (
    [
      ["marketing.pricing.faq1q", "marketing.pricing.faq1a"],
      ["marketing.pricing.faq2q", "marketing.pricing.faq2a"],
      ["marketing.pricing.faq3q", "marketing.pricing.faq3a"],
      ["marketing.pricing.faq4q", "marketing.pricing.faq4a"],
    ] as const
  ).map(([questionKey, answerKey]) => [t(questionKey), t(answerKey)]);
  return (
    <>
      <Nav />
      <main id="main-content" className="bg-background text-foreground">
        <PageHeader
          eyebrow={t("marketing.pricing.title")}
          title={
            <>
              {t("marketing.pricing.headlineStart")}
              <br />
              <span className="text-gold">
                {t("marketing.pricing.headlineEnd")}
              </span>
            </>
          }
          lede={t("marketing.pricing.lede")}
        />

        <section className="py-16 md:py-24 border-b border-border">
          <PricingPlans />
        </section>

        <section className="py-16 md:py-24">
          <div className="mx-auto max-w-3xl px-6 lg:px-10">
            <h2 className="font-display text-3xl text-ivory mb-10 text-center">
              {t("marketing.pricing.questions")}
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
                  <p className="mt-3 text-muted-foreground leading-relaxed">
                    {a}
                  </p>
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
