import type { Metadata } from "next";
import { ContactForm } from "@/components/site/contact-form";
import { Nav } from "@/components/site/nav";
import { SiteFooter } from "@/components/site/footer";
import { PageHeader } from "@/components/site/section-label";

export const metadata: Metadata = {
  title: "Contact — MuseumLite",
  description:
    "Request a private 30-minute walkthrough with our team — or write to us in Florence or Edinburgh.",
  openGraph: {
    title: "Contact — MuseumLite",
    description: "Request a private tour.",
  },
};

export default function ContactPage() {
  return (
    <main className="bg-background text-foreground">
      <Nav />
      <PageHeader
        eyebrow="Request a Tour"
        title={<>The doors are <em className="not-italic text-gold">open.</em></>}
        lede="Tell us about your collection. We'll arrange a private 30-minute walkthrough with a registrar from our team."
      />

      <section className="py-24">
        <div className="mx-auto max-w-7xl px-6 lg:px-10 grid md:grid-cols-12 gap-16">
          <div className="md:col-span-7">
            <ContactForm />
          </div>

          <aside className="md:col-span-4 md:col-start-9 space-y-12">
            <div>
              <div className="text-[10px] uppercase tracking-[0.3em] text-gold mb-4">Florence Studio</div>
              <p className="font-display text-2xl text-ivory leading-snug">
                Via dei Pepi 32<br />
                50122 Firenze, Italy
              </p>
              <p className="mt-3 text-sm text-muted-foreground">+39 055 0123 456</p>
            </div>
            <div>
              <div className="text-[10px] uppercase tracking-[0.3em] text-gold mb-4">Edinburgh Studio</div>
              <p className="font-display text-2xl text-ivory leading-snug">
                14 George IV Bridge<br />
                Edinburgh EH1 1EE, UK
              </p>
              <p className="mt-3 text-sm text-muted-foreground">+44 131 555 0144</p>
            </div>
            <div className="pt-8 border-t border-border">
              <div className="text-[10px] uppercase tracking-[0.3em] text-gold mb-4">Press & Partnerships</div>
              <a href="mailto:hello@museumlite.app" className="font-display text-2xl text-ivory hover:text-gold transition-colors">
                hello@museumlite.app
              </a>
            </div>
          </aside>
        </div>
      </section>
      <SiteFooter />
    </main>
  );
}
