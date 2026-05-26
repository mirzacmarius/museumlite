import { ContactForm } from "@/components/site/contact-form";
import { SiteFooter } from "@/components/site/footer";
import { Nav } from "@/components/site/nav";
import { PageHeader } from "@/components/site/section-label";
import { createPageMetadata } from "@/lib/metadata";
import { siteConfig } from "@/lib/site";

export const metadata = createPageMetadata({
  title: "Contact",
  description:
    "Request a private 30-minute MuseumLite walkthrough — tell us about your collection and workflows.",
  path: "/contact",
});

export default function ContactPage() {
  return (
    <>
      <Nav />
      <main id="main-content" className="bg-background text-foreground">
        <PageHeader
          eyebrow="Contact"
          title={
            <>
              Request a <span className="text-gold">tour</span>
            </>
          }
          lede="Tell us about your collection and team. We will arrange a focused walkthrough — accession, exhibitions, or conservation, depending on what you need most."
        />

        <section className="py-16 md:py-24">
          <div className="mx-auto max-w-7xl px-6 lg:px-10 grid md:grid-cols-12 gap-16">
            <div className="md:col-span-7">
              <ContactForm />
            </div>

            <aside className="md:col-span-4 md:col-start-9 space-y-10">
              <div>
                <div className="text-[10px] font-medium uppercase tracking-[0.25em] text-gold mb-3">
                  Email
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
                  We typically respond within two business days. Early partner
                  slots are limited while we refine the product with museum
                  teams.
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
