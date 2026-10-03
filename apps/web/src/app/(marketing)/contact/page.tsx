import { ContactForm } from "@/components/site/contact-form";
import { SiteFooter } from "@/components/site/footer";
import { Nav } from "@/components/site/nav";
import { PageHeader } from "@/components/site/section-label";
import { createPageMetadata } from "@/lib/metadata";
import { siteConfig } from "@/lib/site";
import { getWebI18n } from "@/locales/server";

export async function generateMetadata() {
  const { locale, t } = await getWebI18n();
  return createPageMetadata({
    title: t("marketing.contact.title"),
    description: t("marketing.contact.description"),
    path: "/contact",
    locale,
  });
}

export default async function ContactPage() {
  const { t } = await getWebI18n();
  return (
    <>
      <Nav />
      <main id="main-content" className="bg-background text-foreground">
        <PageHeader
          eyebrow={t("marketing.contact.title")}
          title={
            <>
              {t("marketing.contact.requestTour")}{" "}
              <span className="text-gold">{t("marketing.contact.tour")}</span>
            </>
          }
          lede={t("marketing.contact.lede")}
        />

        <section className="py-16 md:py-24">
          <div className="mx-auto max-w-7xl px-6 lg:px-10 grid md:grid-cols-12 gap-16">
            <div className="md:col-span-7">
              <ContactForm />
            </div>

            <aside className="md:col-span-4 md:col-start-9 space-y-10">
              <div>
                <div className="text-[10px] font-medium uppercase tracking-[0.25em] text-gold mb-3">
                  {t("marketing.contact.email")}
                </div>
                <a
                  href={`mailto:${siteConfig.contactEmail}`}
                  className="font-display text-2xl text-ivory hover:text-gold transition-colors"
                >
                  {siteConfig.contactEmail}
                </a>
              </div>
              <div className="pt-8 border-t border-border">
                <p className="text-sm text-muted-foreground leading-relaxed">
                  {t("marketing.contact.responseTime")}
                </p>
              </div>
            </aside>
          </div>
        </section>

        <SiteFooter />
      </main>
    </>
  );
}
